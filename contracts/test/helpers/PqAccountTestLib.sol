// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

library PqUserOpBuilder {
    uint128 internal constant VERIFICATION_GAS = 10_000_000;
    uint128 internal constant CALL_GAS = 500_000;
    uint128 internal constant PRE_VERIFICATION_GAS = 150_000;
    uint128 internal constant MAX_FEE = 1 gwei;
    uint128 internal constant MAX_PRIORITY_FEE = 1 gwei;

    function packGasLimits(uint128 verificationGas, uint128 callGas) internal pure returns (bytes32) {
        return bytes32(uint256(verificationGas) << 128 | uint256(callGas));
    }

    function packGasFees(uint128 maxPriorityFee, uint128 maxFee) internal pure returns (bytes32) {
        return bytes32(uint256(maxPriorityFee) << 128 | uint256(maxFee));
    }

    function defaultGasLimits() internal pure returns (bytes32) {
        return packGasLimits(VERIFICATION_GAS, CALL_GAS);
    }

    function defaultGasFees() internal pure returns (bytes32) {
        return packGasFees(MAX_PRIORITY_FEE, MAX_FEE);
    }
}
