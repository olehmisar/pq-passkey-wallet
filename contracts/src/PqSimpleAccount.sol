// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Initializable} from "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";
import {BaseAccount} from "account-abstraction/core/BaseAccount.sol";
import {IEntryPoint} from "account-abstraction/interfaces/IEntryPoint.sol";
import {PackedUserOperation} from "account-abstraction/interfaces/PackedUserOperation.sol";
import {SIG_VALIDATION_FAILED, SIG_VALIDATION_SUCCESS} from "account-abstraction/core/Helpers.sol";
import {TokenCallbackHandler} from "account-abstraction/accounts/callback/TokenCallbackHandler.sol";
import {ISigVerifier} from "InterfaceVerifier/IVerifier.sol";

/**
 * @notice ERC-4337 smart account based on eth-infinitism SimpleAccount, with FIPS-204 ML-DSA
 *         signature validation instead of secp256k1 ECDSA.
 * @dev `pkPointer` is the SSTORE2 pointer address returned by `ZKNOX_dilithium.setKey`.
 */
contract PqSimpleAccount is BaseAccount, TokenCallbackHandler, UUPSUpgradeable, Initializable {
    /// @dev SSTORE2 pointer holding the expanded ML-DSA public key.
    address public pkPointer;

    IEntryPoint private immutable _entryPoint;
    ISigVerifier public immutable verifier;

    event PqSimpleAccountInitialized(
        IEntryPoint indexed entryPoint, address indexed pkPointer, address indexed verifier
    );

    error NotAccountSelf(address msgSender, address entity);
    error NotEntryPoint(address msgSender, address entity, address entryPoint);
    error ZeroPkPointer();

    /// @inheritdoc BaseAccount
    function entryPoint() public view virtual override returns (IEntryPoint) {
        return _entryPoint;
    }

    receive() external payable {}

    constructor(IEntryPoint anEntryPoint, ISigVerifier aVerifier) {
        _entryPoint = anEntryPoint;
        verifier = aVerifier;
        _disableInitializers();
    }

    function initialize(address anPkPointer) public virtual initializer {
        if (anPkPointer == address(0)) revert ZeroPkPointer();
        pkPointer = anPkPointer;
        emit PqSimpleAccountInitialized(entryPoint(), pkPointer, address(verifier));
    }

    /// @dev Admin paths (withdraw, upgrade) run via EntryPoint-routed `execute(address(this), …)`.
    function _onlyAccountSelf() internal view {
        if (msg.sender != address(this)) {
            revert NotAccountSelf(msg.sender, address(this));
        }
    }

    function _requireForExecute() internal view override {
        if (msg.sender != address(entryPoint())) {
            revert NotEntryPoint(msg.sender, address(this), address(entryPoint()));
        }
    }

    /// @inheritdoc BaseAccount
    function _validateSignature(PackedUserOperation calldata userOp, bytes32 userOpHash)
        internal
        view
        override
        returns (uint256 validationData)
    {
        bytes memory pk = abi.encodePacked(pkPointer);
        bytes4 result = verifier.verify(pk, userOpHash, userOp.signature);
        if (result != ISigVerifier.verify.selector) {
            return SIG_VALIDATION_FAILED;
        }
        return SIG_VALIDATION_SUCCESS;
    }

    function getDeposit() public view returns (uint256) {
        return entryPoint().balanceOf(address(this));
    }

    function addDeposit() public payable {
        entryPoint().depositTo{value: msg.value}(address(this));
    }

    function withdrawDepositTo(address payable withdrawAddress, uint256 amount) public {
        _onlyAccountSelf();
        entryPoint().withdrawTo(withdrawAddress, amount);
    }

    function _authorizeUpgrade(address) internal view override {
        _onlyAccountSelf();
    }
}
