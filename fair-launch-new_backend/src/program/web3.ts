import { TokenStandard, createAndMint, mplTokenMetadata } from "@metaplex-foundation/mpl-token-metadata";
import { createSignerFromKeypair, generateSigner, percentAmount, signerIdentity, signTransaction } from "@metaplex-foundation/umi";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { AccountMeta, Blockhash, ComputeBudgetProgram, Connection, Keypair, PublicKey, SYSVAR_RENT_PUBKEY, Signer, SystemProgram, Transaction, TransactionInstruction, TransactionMessage, TransactionResponse, VersionedTransaction, clusterApiUrl, sendAndConfirmTransaction } from "@solana/web3.js";
import base58 from "bs58";
import { Types } from "mongoose";
import Coin from "../models/Coin";
import { createLPIx, initializeIx, removeLiquidityIx } from "./web3Provider";
import { web3 } from "@coral-xyz/anchor";
import NodeWallet from "@coral-xyz/anchor/dist/cjs/nodewallet";
import { PROGRAM_ID } from "./cli/programId";
import { AuthorityType, TOKEN_PROGRAM_ID, createSetAuthorityInstruction, createTransferInstruction, getAssociatedTokenAddress, getOrCreateAssociatedTokenAccount } from "@solana/spl-token";
import { SwapAccounts, SwapArgs, swap } from "./cli/instructions";
import * as anchor from "@coral-xyz/anchor"
import { ASSOCIATED_PROGRAM_ID } from "@coral-xyz/anchor/dist/cjs/utils/token";
import { getMCap, setCoinStatus } from "../routes/coinStatus";
import CoinStatus from "../models/CoinsStatus";
import { simulateTransaction } from "@coral-xyz/anchor/dist/cjs/utils/rpc";
import pinataSDK from '@pinata/sdk';
import { io } from "../sockets";
import axios from "axios";
import { bundle } from "./jito";
import { setComputeUnitLimit, setComputeUnitPrice } from "@metaplex-foundation/mpl-toolbox";
import { toWeb3JsKeypair } from '@metaplex-foundation/umi-web3js-adapters';

require('dotenv').config();

const curveSeed = "CurveConfiguration"
const POOL_SEED_PREFIX = "liquidity_pool"
const PINATA_SECRET_API_KEY = process.env.PINATA_SECRET_API_KEY
const PINATA_GATEWAY_URL = process.env.PINATA_GATEWAY_URL;
const SOLANA_RPC = process.env.PUBLIC_SOLANA_RPC;

export const connection = new Connection(SOLANA_RPC)
const privateKey = base58.decode(process.env.PRIVATE_KEY!);

export const adminKeypair = web3.Keypair.fromSecretKey(privateKey);
const adminWallet = new NodeWallet(adminKeypair);

const umi = createUmi(SOLANA_RPC, { commitment: "confirmed" });

const userWallet = umi.eddsa.createKeypairFromSecretKey(privateKey);

const userWalletSigner = createSignerFromKeypair(umi, userWallet);
umi.use(signerIdentity(userWalletSigner));
umi.use(mplTokenMetadata());

export const uploadMetadata = async (data: CoinInfo): Promise<any> => {
    const metadata = {
        name: data.name,
        symbol: data.ticker,
        image: data.url,
        description: data.description,
    }
    const pinata = new pinataSDK({ pinataJWTKey: PINATA_SECRET_API_KEY });

    try {
        const res = await pinata.pinJSONToIPFS(metadata);
        return res.IpfsHash
    } catch (error) {
        console.error('Error uploading metadata: ', error);
        return error;
    }
}
// Initialize Transaction for smart contract
export const initializeTx = async () => {
    const initTx = await initializeIx(adminWallet.publicKey);
    const createTx = new Transaction().add(initTx.ix);
    createTx.feePayer = adminWallet.publicKey;
    createTx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash

    const txId = await sendAndConfirmTransaction(connection, createTx, [adminKeypair]);
}


// Create Token and add liquidity transaction
export const createToken = async (data: CoinInfo) => {
    const uri = await uploadMetadata(data);

    const mint = generateSigner(umi);

    const tx = createAndMint(umi, {
        mint,
        authority: umi.identity,
        name: data.name,
        symbol: data.ticker,
        uri: `${PINATA_GATEWAY_URL}/${uri}`,
        sellerFeeBasisPoints: percentAmount(0),
        decimals: 6,
        amount: 1000_000_000_000_000,
        tokenOwner: userWallet.publicKey,
        tokenStandard: TokenStandard.Fungible,
    })

    try {
        const lpTx = await createLPIx(new PublicKey(mint.publicKey), adminKeypair.publicKey, 0)
        const buyTx = await swapTx(new PublicKey(mint.publicKey), data.presale ? data.presale : 0);
        const createTx = new Transaction().add(lpTx.ix);

        let freezeAuthIx = createSetAuthorityInstruction(
            new PublicKey(mint.publicKey),
            adminWallet.publicKey,
            AuthorityType.FreezeAccount,
            null
        );
        let minthAuthIx = createSetAuthorityInstruction(
            new PublicKey(mint.publicKey),
            adminWallet.publicKey,
            AuthorityType.MintTokens,
            null
        );
        createTx.add(freezeAuthIx, minthAuthIx);
        if (buyTx) createTx.add(buyTx);

        const mintIxs: TransactionInstruction[] = [];

        // mintIxs.push(ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 200_000 }));
        // mintIxs.push(ComputeBudgetProgram.setComputeUnitLimit({ units: 200_000 }));
        

        const tmpIxs = tx.getInstructions();
        tmpIxs.map((ix) => {
            const keys: Array<AccountMeta> = [];

            ix.keys.map((key) => {
                keys.push({
                    pubkey: new PublicKey(key.pubkey),
                    isSigner: key.isSigner,
                    isWritable: key.isWritable
                })
            });

            mintIxs.push(new TransactionInstruction({
                keys,
                programId: new PublicKey(ix.programId),
                data: Buffer.from(ix.data)
            }));
        })

        let blockhash = await connection.getLatestBlockhash();

        const mintMessageV0 = new TransactionMessage({
            payerKey: adminWallet.publicKey,
            recentBlockhash: blockhash.blockhash,
            instructions: mintIxs,
        }).compileToV0Message([]);

        const mintTxV = new VersionedTransaction(mintMessageV0);


        blockhash = await connection.getLatestBlockhash();

        const createMessageV0 = new TransactionMessage({
            payerKey: adminWallet.publicKey,
            recentBlockhash: blockhash.blockhash,
            instructions: createTx.instructions,
        }).compileToV0Message([]);

        const createTxV = new VersionedTransaction(createMessageV0);
        const signedCreateTx = await adminWallet.signTransaction(createTxV);

        const mintKp = toWeb3JsKeypair(mint);
        const mintSigner = new NodeWallet(mintKp);
        const signedMintTx = await adminWallet.signTransaction(await mintSigner.signTransaction(mintTxV));

        const ret = await bundle([signedMintTx, signedCreateTx], adminKeypair, connection);

        if (ret == 0)
            throw "Bundling failed";

        const newCoin = new Coin({
            creator: data.creator,
            name: data.name,
            ticker: data.ticker,
            description: data.description,
            token: mint.publicKey,
            url: data.url,
            marketcap: data.marketcap ? data.marketcap : 5000
        });

        const response = await newCoin.save();``
        const newCoinStatus = new CoinStatus({
            coinId: response._id,
            record: [
                {
                    holder: response.creator,
                    holdingStatus: 2,
                    amount: 0,
                    tx: ret,
                    price: newCoin.reserveTwo / newCoin.reserveOne
                }
            ]
        })
        await newCoinStatus.save();
        if (io != null) io.emit("TokenCreated", data.name, mint.publicKey)
        
        return response
    } catch (error) {
        console.log(error);
        if (io != null) io.emit("TokenNotCreated", data.name, mint.publicKey)
        return "transaction failed"
    }

}

export const transferTokenTx = async (
    to: PublicKey,
    mint: PublicKey,
) => {
    try {
        const sourceAccount = await getOrCreateAssociatedTokenAccount(
            connection,
            adminKeypair,
            mint,
            adminKeypair.publicKey
        );
        const destinationAccount = await getOrCreateAssociatedTokenAccount(
            connection,
            adminKeypair,
            mint,
            to
        );

        const amount = await connection.getTokenAccountBalance(sourceAccount.address);
        const tx = new Transaction();
        tx.add(createTransferInstruction(
            sourceAccount.address,
            destinationAccount.address,
            adminKeypair.publicKey,
            parseInt(amount.value.amount)
        ));
        return tx;
    } catch (error) {
        console.log("Error: ", error)
    }
}

// check transaction
export const checkTransactionStatus = async (transactionId: string) => {
    try {
        // Fetch the transaction details using the transaction ID
        const transactionResponse: TransactionResponse | null = await connection.getTransaction(transactionId);

        // If the transactionResponse is null, the transaction is not found
        if (transactionResponse === null) {
            return false;
        }

        // Check the status of the transaction
        if (transactionResponse.meta && transactionResponse.meta.err === null) {
            return true;
        } else {
            return false
        }
    } catch (error) {
        console.error(`Error fetching transaction ${transactionId}:`, error);
        return false;
    }
}

// Swap transaction
export const swapTx = async (
    mint1: PublicKey, amount: number
) => {
    if (!amount) return;
    try {
        const [curveConfig] = PublicKey.findProgramAddressSync(
            [Buffer.from(curveSeed)],
            PROGRAM_ID
        )
        const [poolPda] = PublicKey.findProgramAddressSync(
            [Buffer.from(POOL_SEED_PREFIX), mint1.toBuffer()],
            PROGRAM_ID
        )
        const [globalAccount] = PublicKey.findProgramAddressSync(
            [Buffer.from("global")],
            PROGRAM_ID
        )

        const poolTokenOne = await getAssociatedTokenAddress(
            mint1, globalAccount, true
        )
        const userAta1 = await getAssociatedTokenAddress(
            mint1, adminKeypair.publicKey
        )

        const args: SwapArgs = {
            amount: new anchor.BN(amount * 1_000_000_000),
            style: new anchor.BN(2)
        }

        const acc: SwapAccounts = {
            dexConfigurationAccount: curveConfig,
            pool: poolPda,
            globalAccount,
            mintTokenOne: mint1,
            poolTokenAccountOne: poolTokenOne,
            userTokenAccountOne: userAta1,
            user: adminKeypair.publicKey,
            tokenProgram: TOKEN_PROGRAM_ID,
            associatedTokenProgram: ASSOCIATED_PROGRAM_ID,
            rent: SYSVAR_RENT_PUBKEY,
            systemProgram: SystemProgram.programId
        }

        const dataIx = swap(args, acc, PROGRAM_ID)
        const tx = new Transaction().add(dataIx);
        return tx;
    } catch (error) {
        console.log("Error in swap transaction", error)
    }
}

// Get info when user buy or sell token
const logTx = connection.onLogs(PROGRAM_ID, async (logs, ctx) => {
    if (logs.err !== null) {
        return undefined
    }
    if (logs.logs[1].includes('AddLiquidity')) {
        await sleep(3000)
    }
    await sleep(3000)

    // Get parsed log data
    const parsedData: ResultType = parseLogs(logs.logs, logs.signature);

    if (parsedData.swapType === 0) return;
    const solPrice = await getSolPriceInUSD();
    const { creator, marketcap } = await getMCap(parsedData);
    try {
        if (parsedData.reserve2 / parsedData.reserve1 * 1000000 * solPrice > (marketcap ? marketcap : 5000)) {
            // Remove liquidity pool and move to Raydium
            await createRaydium(new PublicKey(parsedData.mint), new PublicKey(creator), (parsedData.reserve2 - 30000000000) * 95 / 100 + 30000000000);
        }
    } catch (error) {
        console.log("Error in Logs: ", error)
    }
    await setCoinStatus(parsedData)

}, "confirmed")

// Remove liquidity pool and Create Raydium Pool
export const createRaydium = async (mint1: PublicKey, creator: PublicKey, amount: number) => {
    const amountOne = 1000_000_000_000;
    const amountTwo = 1000_000_000_000;
    const radyiumIx = await removeLiquidityIx(mint1, adminKeypair.publicKey, connection, amount);

    if (radyiumIx == undefined) return;

    const latestBlockhash = await connection.getLatestBlockhash();
    const txs: VersionedTransaction[] = [];

    for (const iTx of radyiumIx.willSendTx) {
        if (iTx instanceof VersionedTransaction) {
            iTx.sign([adminKeypair]);
            await connection.sendTransaction(iTx, {
                preflightCommitment: "confirmed",
                skipPreflight: true
            });
        } else {
            await sendAndConfirmTransaction(connection, iTx, [adminKeypair], {
                preflightCommitment: "confirmed",
                skipPreflight: true
            });
        }
    }

    const tx = new Transaction().add(
        ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 }),
        ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 100_000 })
    );

    for (let i = 0; i < radyiumIx.ixs.length; i++) {
        tx.add(radyiumIx.ixs[i]);
    }

    const transferTx = await transferTokenTx(
        creator,
        mint1
    );

    if (transferTx) tx.add(transferTx);

    tx.feePayer = adminKeypair.publicKey;
    tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash

    const ret = await simulateTransaction(connection, tx);

    if (!ret.value.logs) return "";
    for (let i = 0; i < ret.value.logs?.length; i++)
        console.log(ret.value.logs[i]);

    console.log("LOGS FOR SIMULATION: ", await simulateTransaction(connection, tx))
    const sig = await sendAndConfirmTransaction(connection, tx, [adminKeypair], { preflightCommitment: "confirmed", skipPreflight: true })
    return sig

}

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}
// Get swap(buy and sell)
function parseLogs(logs: string[], tx: string) {
    const result: ResultType = {
        tx,
        mint: '',
        owner: '',
        swapType: 0,
        swapAmount: 0,
        reserve1: 0,
        reserve2: 0
    };
    logs.forEach(log => {
        if (log.includes('Mint: ')) {
            result.mint = (log.split(' ')[3]);
        }
        if (log.includes('Swap: ')) {
            result.owner = log.split(' ')[3];
            result.swapType = parseInt(log.split(' ')[4]);
            result.swapAmount = parseInt(log.split(' ')[5]);
        }
        if (log.includes('Reserves: ')) {
            result.reserve1 = parseInt(log.split(' ')[3]);
            result.reserve2 = parseInt(log.split(' ')[4]);
        }
    });
    return result;
}
export const getSolPriceInUSD = async () => {
    try {
        // Fetch the price data from CoinGecko
        const response = await axios.get('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd');
        const solPriceInUSD = response.data.solana.usd;
        return solPriceInUSD;
    } catch (error) {
        console.error('Error fetching SOL price:', error);
        throw error;
    }
}
export interface CoinInfo {
    creator?: Types.ObjectId;
    name: string;
    ticker: string;
    url: string;
    description?: string;
    token?: string;
    reserve1?: number;
    reserve2?: number;
    marketcap?: number;
    presale?: number;
}

export interface ResultType {
    tx: string,
    mint: string;
    owner: string;
    swapType: number;
    swapAmount: number;
    reserve1: number;
    reserve2: number;
}
