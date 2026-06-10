// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";
import {EntryPoint} from "account-abstraction/core/EntryPoint.sol";
import {IEntryPoint} from "account-abstraction/interfaces/IEntryPoint.sol";
import {PackedUserOperation} from "account-abstraction/interfaces/PackedUserOperation.sol";
import {BaseAccount} from "account-abstraction/core/BaseAccount.sol";
import {SIG_VALIDATION_FAILED, SIG_VALIDATION_SUCCESS} from "account-abstraction/core/Helpers.sol";
import {ZKNOX_dilithium} from "zknox/ZKNOX_dilithium.sol";
import {ISigVerifier} from "InterfaceVerifier/IVerifier.sol";
import {PqSimpleAccount} from "../src/PqSimpleAccount.sol";
import {PqSimpleAccountFactory} from "../src/PqSimpleAccountFactory.sol";
import {PqSimpleAccountV2} from "./mocks/PqSimpleAccountV2.sol";
import {PqTestVectors} from "./helpers/PqTestVectors.sol";
import {PqUserOpBuilder} from "./helpers/PqAccountTestLib.sol";

contract PqSimpleAccountTest is Test {
    EntryPoint internal entryPoint;
    ZKNOX_dilithium internal verifier;
    PqSimpleAccountFactory internal factory;
    address internal pkPointer;
    PqSimpleAccount internal account;
    PqSimpleAccountV2 internal accountV2Impl;

    address internal bundler = makeAddr("bundler");
    address internal beneficiary = makeAddr("beneficiary");
    address internal withdrawRecipient = makeAddr("withdrawRecipient");

    uint256 internal constant ACCOUNT_SALT = 0;
    uint256 internal constant ENTRY_POINT_DEPOSIT = 1 ether;
    uint256 internal constant WITHDRAW_AMOUNT = 0.25 ether;

    function setUp() public {
        entryPoint = new EntryPoint();
        verifier = new ZKNOX_dilithium();
        factory = new PqSimpleAccountFactory(IEntryPoint(address(entryPoint)), address(verifier));
        accountV2Impl = new PqSimpleAccountV2(IEntryPoint(address(entryPoint)), ISigVerifier(address(verifier)));

        pkPointer = _registerPublicKey(PqTestVectors.DEPLOYMENT_PUBLIC_KEY);
        account = _deployAccount(pkPointer, ACCOUNT_SALT);

        vm.deal(address(account), 10 ether);
        vm.prank(address(account));
        account.addDeposit{value: ENTRY_POINT_DEPOSIT}();
    }

    // --- initialization ---

    function test_initialize_revertsZeroPkPointer() public {
        PqSimpleAccount impl = factory.accountImplementation();
        vm.expectRevert(PqSimpleAccount.ZeroPkPointer.selector);
        new ERC1967Proxy(
            address(impl),
            abi.encodeCall(PqSimpleAccount.initialize, (address(0)))
        );
    }

    // --- signature validation ---

    function test_validateUserOp_acceptsValidMlDsaSignature() public {
        PackedUserOperation memory userOp;
        userOp.signature = PqTestVectors.SIG_FOR_HASH_CD;

        uint256 validationData = _validateAsEntryPoint(userOp, PqTestVectors.USER_OP_HASH_CD);
        assertEq(validationData, SIG_VALIDATION_SUCCESS);
    }

    function test_validateUserOp_rejectsTamperedSignature() public {
        PackedUserOperation memory userOp;
        userOp.signature = PqTestVectors.SIG_FOR_HASH_CD;
        userOp.signature[0] = bytes1(uint8(userOp.signature[0]) ^ 0xff);

        uint256 validationData = _validateAsEntryPoint(userOp, PqTestVectors.USER_OP_HASH_CD);
        assertEq(validationData, SIG_VALIDATION_FAILED);
    }

    function test_validateUserOp_rejectsWrongUserOpHash() public {
        PackedUserOperation memory userOp;
        userOp.signature = PqTestVectors.SIG_FOR_HASH_CD;

        uint256 validationData =
            _validateAsEntryPoint(userOp, bytes32(uint256(PqTestVectors.USER_OP_HASH_CD) ^ 1));
        assertEq(validationData, SIG_VALIDATION_FAILED);
    }

    function test_verifier_rejectsTamperedSignatureForKnownHash() public view {
        bytes memory pk = abi.encodePacked(pkPointer);
        bytes memory sig = PqTestVectors.SIG_FOR_HASH_CD;
        sig[0] = bytes1(uint8(sig[0]) ^ 0xff);
        bytes4 result = verifier.verify(pk, PqTestVectors.USER_OP_HASH_CD, sig);
        assertEq(result, bytes4(0xFFFFFFFF));
    }

    // --- execute / withdraw authorization ---

    function test_execute_revertsWhenCallerIsNotEntryPoint() public {
        vm.prank(address(0xb0b));
        vm.expectRevert(
            abi.encodeWithSelector(
                PqSimpleAccount.NotEntryPoint.selector,
                address(0xb0b),
                address(account),
                address(entryPoint)
            )
        );
        account.execute(address(0xdead), 0, "");
    }

    function test_withdrawDepositTo_revertsWhenNotAccountSelf() public {
        vm.prank(address(entryPoint));
        vm.expectRevert(
            abi.encodeWithSelector(
                PqSimpleAccount.NotAccountSelf.selector, address(entryPoint), address(account)
            )
        );
        account.withdrawDepositTo(payable(withdrawRecipient), WITHDRAW_AMOUNT);
    }

    function test_withdrawViaEntryPointSelfCallUserOp() public {
        uint256 recipientBefore = withdrawRecipient.balance;
        uint256 depositBefore = account.getDeposit();

        PackedUserOperation memory userOp = _buildSignedUserOp(
            _encodeExecuteSelf(
                abi.encodeCall(PqSimpleAccount.withdrawDepositTo, (payable(withdrawRecipient), WITHDRAW_AMOUNT))
            )
        );

        vm.deal(bundler, 1 ether);
        vm.startPrank(bundler, bundler);
        entryPoint.handleOps(_single(userOp), payable(beneficiary));
        vm.stopPrank();

        assertEq(withdrawRecipient.balance, recipientBefore + WITHDRAW_AMOUNT);
        assertGe(depositBefore - account.getDeposit(), WITHDRAW_AMOUNT);
    }

    // --- upgrade authorization ---

    function test_upgradeTo_revertsWhenCallerIsNotAccountSelf() public {
        vm.prank(address(0xabad));
        vm.expectRevert(
            abi.encodeWithSelector(PqSimpleAccount.NotAccountSelf.selector, address(0xabad), address(account))
        );
        UUPSUpgradeable(address(account)).upgradeToAndCall(address(accountV2Impl), "");
    }

    function test_upgradeViaEntryPointSelfCallUserOp() public {
        PackedUserOperation memory userOp = _buildSignedUserOp(
            _encodeExecuteSelf(
                abi.encodeCall(
                    UUPSUpgradeable.upgradeToAndCall, (address(accountV2Impl), "")
                )
            )
        );

        vm.deal(bundler, 1 ether);
        vm.startPrank(bundler, bundler);
        entryPoint.handleOps(_single(userOp), payable(beneficiary));
        vm.stopPrank();

        assertEq(PqSimpleAccountV2(payable(address(account))).accountVersion(), 2);
    }

    // --- helpers ---

    function _registerPublicKey(bytes memory deploymentPublicKey) internal returns (address pointer) {
        bytes memory encoded = verifier.setKey(deploymentPublicKey);
        pointer = address(uint160(bytes20(encoded)));
    }

    function _deployAccount(address anPkPointer, uint256 salt) internal returns (PqSimpleAccount deployed) {
        PqSimpleAccount impl = factory.accountImplementation();
        deployed = PqSimpleAccount(
            payable(
                new ERC1967Proxy{salt: bytes32(salt)}(
                    address(impl),
                    abi.encodeCall(PqSimpleAccount.initialize, (anPkPointer))
                )
            )
        );
    }

    function _encodeExecuteSelf(bytes memory innerCall) internal view returns (bytes memory) {
        return abi.encodeCall(BaseAccount.execute, (address(account), 0, innerCall));
    }

    function _buildSignedUserOp(bytes memory callData) internal returns (PackedUserOperation memory userOp) {
        userOp.sender = address(account);
        userOp.nonce = 0;
        userOp.initCode = "";
        userOp.callData = callData;
        userOp.accountGasLimits = PqUserOpBuilder.defaultGasLimits();
        userOp.preVerificationGas = PqUserOpBuilder.PRE_VERIFICATION_GAS;
        userOp.gasFees = PqUserOpBuilder.defaultGasFees();
        userOp.paymasterAndData = "";
        userOp.signature = _pqSign(entryPoint.getUserOpHash(userOp));
    }

    function _validateAsEntryPoint(PackedUserOperation memory userOp, bytes32 userOpHash)
        internal
        returns (uint256 validationData)
    {
        vm.prank(address(entryPoint));
        validationData = account.validateUserOp(userOp, userOpHash, 0);
    }

    function _pqSign(bytes32 userOpHash) internal returns (bytes memory signature) {
        string[] memory inputs = new string[](3);
        inputs[0] = "node";
        inputs[1] = string.concat(vm.projectRoot(), "/../scripts/forge-sign-pq.mjs");
        inputs[2] = Strings.toHexString(uint256(userOpHash), 32);
        signature = vm.ffi(inputs);
        assertEq(signature.length, 2420, "unexpected ML-DSA signature length");
    }

    function _single(PackedUserOperation memory userOp)
        internal
        pure
        returns (PackedUserOperation[] memory ops)
    {
        ops = new PackedUserOperation[](1);
        ops[0] = userOp;
    }
}
