import { JsonRpcProvider } from "ethers";
import { ENV } from "../src/config/env";

export const provider = new JsonRpcProvider(ENV.RPC_URL);
