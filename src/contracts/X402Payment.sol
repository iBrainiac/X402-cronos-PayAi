// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;


interface IERC20 {
function transferFrom(address from, address to, uint256 amount) external returns (bool);
}


contract X402Payment {
IERC20 public immutable paymentToken;
address public immutable treasury;


event PaymentSettled(address indexed payer, bytes32 indexed serviceId, uint256 amount, uint256 timestamp);


constructor(address _paymentToken, address _treasury) {
paymentToken = IERC20(_paymentToken);
treasury = _treasury;
}


function pay(bytes32 serviceId, uint256 amount) external {
require(amount > 0, "amount=0");
require(paymentToken.transferFrom(msg.sender, treasury, amount), "transfer failed");
emit PaymentSettled(msg.sender, serviceId, amount, block.timestamp);
}
}