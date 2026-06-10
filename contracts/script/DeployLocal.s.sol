// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Script.sol";
import {EntryPoint} from "account-abstraction/core/EntryPoint.sol";
import {IEntryPoint} from "account-abstraction/interfaces/IEntryPoint.sol";
import {ZKNOX_dilithium} from "zknox/ZKNOX_dilithium.sol";
import {PqSimpleAccountFactory} from "../src/PqSimpleAccountFactory.sol";

/// @dev Local / Anvil deployment of EntryPoint v0.9 + FIPS-204 ML-DSA verifier + PQ factory.
contract DeployLocal is Script {
    struct Deployment {
        address entryPoint;
        address verifier;
        address factory;
    }

    function run() external returns (Deployment memory deployment) {
        vm.startBroadcast();
        deployment.entryPoint = address(new EntryPoint());
        deployment.verifier = address(new ZKNOX_dilithium());
        deployment.factory = address(
            new PqSimpleAccountFactory(IEntryPoint(deployment.entryPoint), deployment.verifier)
        );
        vm.stopBroadcast();
    }
}
