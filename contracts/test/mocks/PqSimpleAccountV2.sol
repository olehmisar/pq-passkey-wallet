// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IEntryPoint} from "account-abstraction/interfaces/IEntryPoint.sol";
import {ISigVerifier} from "InterfaceVerifier/IVerifier.sol";
import {PqSimpleAccount} from "../../src/PqSimpleAccount.sol";

/// @dev UUPS-compatible implementation used to assert upgrade authorization in tests.
contract PqSimpleAccountV2 is PqSimpleAccount {
    constructor(IEntryPoint anEntryPoint, ISigVerifier aVerifier) PqSimpleAccount(anEntryPoint, aVerifier) {}

    function accountVersion() external pure returns (uint256) {
        return 2;
    }
}
