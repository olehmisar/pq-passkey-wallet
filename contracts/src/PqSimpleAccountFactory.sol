// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Create2} from "@openzeppelin/contracts/utils/Create2.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {IEntryPoint} from "account-abstraction/interfaces/IEntryPoint.sol";
import {ISenderCreator} from "account-abstraction/interfaces/ISenderCreator.sol";
import {ISigVerifier} from "InterfaceVerifier/IVerifier.sol";
import {PqSimpleAccount} from "./PqSimpleAccount.sol";

/**
 * @notice Factory for {PqSimpleAccount} — mirrors eth-infinitism `SimpleAccountFactory`.
 * @dev `createAccount` / `getAddress` take the ML-DSA pk pointer (from `setKey`) and salt.
 */
contract PqSimpleAccountFactory {
    PqSimpleAccount public immutable accountImplementation;
    ISenderCreator public immutable senderCreator;

    error NotSenderCreator(address msgSender, address entity, address senderCreator);

    constructor(IEntryPoint entryPoint, address verifier) {
        accountImplementation = new PqSimpleAccount(entryPoint, ISigVerifier(verifier));
        senderCreator = entryPoint.senderCreator();
    }

    function createAccount(address pkPointer, uint256 salt) public returns (PqSimpleAccount ret) {
        require(
            msg.sender == address(senderCreator),
            NotSenderCreator(msg.sender, address(this), address(senderCreator))
        );

        address addr = getAddress(pkPointer, salt);
        uint256 codeSize = addr.code.length;
        if (codeSize > 0) {
            return PqSimpleAccount(payable(addr));
        }

        ret = PqSimpleAccount(
            payable(
                new ERC1967Proxy{salt: bytes32(salt)}(
                    address(accountImplementation),
                    abi.encodeCall(PqSimpleAccount.initialize, (pkPointer))
                )
            )
        );
    }

    function getAddress(address pkPointer, uint256 salt) public view returns (address) {
        return Create2.computeAddress(
            bytes32(salt),
            keccak256(
                abi.encodePacked(
                    type(ERC1967Proxy).creationCode,
                    abi.encode(
                        address(accountImplementation),
                        abi.encodeCall(PqSimpleAccount.initialize, (pkPointer))
                    )
                )
            )
        );
    }
}
