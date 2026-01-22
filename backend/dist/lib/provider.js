"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.provider = void 0;
const ethers_1 = require("ethers");
const env_1 = require("../config/env");
exports.provider = new ethers_1.JsonRpcProvider(env_1.ENV.RPC_URL);
