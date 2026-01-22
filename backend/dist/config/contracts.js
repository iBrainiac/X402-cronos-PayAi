"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CONTRACTS = void 0;
const X402Payment_json_1 = __importDefault(require("../../../abi/X402Payment.json"));
exports.CONTRACTS = {
    X402_PAYMENT: {
        address: process.env.X402_CONTRACT,
        abi: X402Payment_json_1.default,
    },
};
