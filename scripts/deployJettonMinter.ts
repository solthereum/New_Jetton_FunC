import { toNano } from '@ton/core';
import { JettonMinter, jettonContentToCell } from '../wrappers/JettonMinter';
import { compile, NetworkProvider} from '@ton/blueprint';
import { WalletContractV4 } from '@ton/ton';
import { mnemonicToWalletKey } from "ton-crypto";
import { buildOnchainMetadata } from "./utils/jetton-helpers";
import * as dotenv from "dotenv";
dotenv.config();

const jettonParams = {
    name: "JETTON16",
    description: "This is 5% commission jetton",
    symbol: "JETTON16",
    image: "https://gateway.pinata.cloud/ipfs/QmdKpdkk4YgJnrruQVi7C6ocBAzZ1P3N5ZcRbjXihJYDeq",
};

export async function run(provider: NetworkProvider) {

    let mnemonics = (process.env.mnemonics || "").toString();
    const key = await mnemonicToWalletKey(mnemonics.split(" "));

    const wallet = WalletContractV4.create({ publicKey: key.publicKey, workchain: 0 });

    if (!await provider.isContractDeployed(wallet.address)) {
        return console.log("Owner wallet is not deployed");
    }

    const walletContract = provider.open(wallet);
    const walletSender = walletContract.sender(key.secretKey);

    const seqno = await walletContract.getSeqno();
    
    let admin = wallet.address;

    let content = buildOnchainMetadata(jettonParams);

    // const content = jettonContentToCell({type:0,uri:metadataURI});
    
    const wallet_code = await compile('JettonWallet');

    const minter  = JettonMinter.createFromConfig({admin,
                                                  content,
                                                  wallet_code,
                                                  }, 
                                                  await compile('JettonMinter'));   
                                                  
    console.log("contract  to be deployed:", minter.address.toString());
    if (await provider.isContractDeployed(minter.address)) {
            return console.log("Same Jetton already deployed");
    }

    await provider.open(minter).sendDeploy(walletSender, toNano('0.01'));    
    await provider.waitForDeploy(minter.address);    
    
    await provider.open(minter).sendMint(walletSender, admin, toNano('5000000'), toNano('0.01'), toNano('0.05'));

    let currentSeqno = seqno;
    while (currentSeqno == seqno) {
        console.log("waiting for transaction to confirm...");
        await sleep(1500);
        currentSeqno = await walletContract.getSeqno();
    }
    console.log("Mint transaction confirmed!");
}

function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
