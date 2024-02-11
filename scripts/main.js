require('dotenv').config();
const starknet = require("starknet");
const ERC20 = require("../contracts/ERC20.json");
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'wallets.txt');
let wallets = [];

// Logging and counting object
const operationCounts = {
    totalCalls: 0,
    success: {
        getTransaction: 0,
        deploy: 0,
        transfer: 0
    },
    failure: {
        getTransaction: 0,
        deploy: 0,
        transfer: 0
    }
};

function logOperation(operation, success) {
    const outcome = success ? 'success' : 'failure';
    console.log(`${new Date().toISOString()}: ${operation} ${outcome}`);
    operationCounts.totalCalls++;
    operationCounts[outcome][operation]++;
}

const eth_address = "0x49d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7";
const provider = new starknet.RpcProvider({ nodeUrl: process.env.STARKNET_NODE_URL });
const account = new starknet.Account(provider, "0x4", "0x00c1cf1490de1352865301bb8705143f3ef938f97fdf892f1090dcb5ac7bcd1d", "1");

async function getTransaction(txnHash) {
    try {
        const result = await provider.getTransactionReceipt(txnHash);
        //console.log("This is the transaction receipt - ", result);
        logOperation('getTransaction', true); // Log success
    } catch (error) {
        //console.error("Failed to get transaction receipt:", error);
        logOperation('getTransaction', false); // Log failure
    }
}

function getRandomWallet(wallets) {
    const index = Math.floor(Math.random() * wallets.length);
    return wallets[index];
}

const sierraPath = "./contracts/OpenZeppelinAccountCairoOne.sierra.json";
async function deploy() {
    const currentDir = process.cwd();
    const sierra = require(`${currentDir}/${sierraPath}`);
    let constructorArgs = []; // Adjust as needed
    try{
        const deployResult = await account.deploy({
            classHash: starknet.hash.computeContractClassHash(sierra),
            constructorCalldata: constructorArgs,
        });
        //console.log("This is the deploy result - ", deployResult);
        logOperation('deploy', true); // Log success
    }catch(error){
        //console.error("Failed to deploy contract:", error);
        logOperation('deploy', false); // Log failure
    }
}

async function transfer(to) {
    const contract = new starknet.Contract(ERC20.abi, eth_address, provider);
    let result = await contract.populate("transfer", {
        recipient: to,
        amount: {
            low: 1e20,
            high: 0,
        },
    });
    try{
        let response = await account.execute(result, undefined);
        let hash = response.transaction_hash; // Verify this matches the actual response structure
        //console.log("Txn hash - ", hash);
        logOperation('transfer', true); // Log success
        await getTransaction(hash);
    }catch(error){
        //console.error("Failed to transfer:", error);
        logOperation('transfer', false); // Log failure
    }
    
}


fs.readFile(filePath, { encoding: 'utf-8' }, (err, data) => {
    if (err) {
        console.error('Error reading file:', err);
        return;
    }

    wallets = data.split('\n').filter(line => line.trim() !== '');

    setInterval(async () => {
        // Randomly decide to perform a transfer or deploy with an 80/20 distribution
        const randomNumber = Math.random();
        if (process.env.DETAILED_LOGGING === 'true') {
            console.log("Current operation counts:", operationCounts);
        }
        if(wallets.length > 0 && randomNumber < 0.8) { // 80% chance to transfer
            const randomWallet = getRandomWallet(wallets);
            try {
                await transfer(randomWallet);
            } catch (error) {
                console.error(error);
            }
        } else { // 20% chance to deploy
            try {
                await deploy();
            } catch (error) {
                console.error('Error deploying contract:', error);
            }
        }
    }, process.env.TIME_INTERVAL);
});
