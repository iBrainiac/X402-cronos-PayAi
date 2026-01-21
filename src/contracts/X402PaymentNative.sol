// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract X402PaymentNative {
    address public immutable treasury;

    event PaymentSettled(
        address indexed payer,
        bytes32 indexed serviceId,
        uint256 amount,
        uint256 timestamp
    );

    constructor(address _treasury) {
        require(_treasury != address(0), "treasury=0");
        treasury = _treasury;
    }

    function pay(bytes32 serviceId) external payable {
        require(msg.value > 0, "amount=0");
        require(serviceId != bytes32(0), "serviceId=0");

        // Transfer native CRO to treasury
        (bool success, ) = treasury.call{value: msg.value}("");
        require(success, "transfer failed");

        emit PaymentSettled(msg.sender, serviceId, msg.value, block.timestamp);
    }

    // Optional: helper to check contract balance for debugging
    function contractBalance() external view returns (uint256) {
        return address(this).balance;
    }
}
