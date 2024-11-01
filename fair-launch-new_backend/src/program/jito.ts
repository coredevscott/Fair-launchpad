// Jito Bundling part
import {
    Keypair,
    PublicKey,
    SystemProgram,
    Connection,
    TransactionMessage,
    VersionedTransaction,
} from '@solana/web3.js';
import axios, { AxiosError } from 'axios';
import bs58 from 'bs58';
import dotenv from "dotenv";
dotenv.config();
const JITO_FEE = 100_000;
export const jitoTipAccounts = [
    'Cw8CFyM9FkoMi7K7Crf6HNQqf4uEMzpKw6QNghXLvLkY',
    'DttWaMuVvTiduZRnguLF7jNxTgiMBZ1hyAumKUiL2KRL',
    '96gYZGLnJYVFmbjzopPSU6QiEV5fGqZNyN9nmNhvrZU5',
    '3AVi9Tg9Uo68tJfuvoKvqKNWKkC5wPdSSdeBnizKZ6jT',
    'HFqU5x63VTqvQss8hp11i4wVV8bD44PvwucfZ2bU7gRe',
    'ADaUMid9yfUytqMBgopwjb2DTLSokTSzL1zt6iGPaS49',
    'ADuUkR4vqLUMWXxW9gh6D6L8pMSawimctcNZ5pGwDcEt',
    'DfXygSm4jCyNCybVYYK6DwvWqjKee8pbDmJGcLWNDXjh',
];
const getRandomValidatorKey = (): PublicKey => {
    const randomValidator = jitoTipAccounts[Math.floor(Math.random() * jitoTipAccounts.length)];
    return new PublicKey(randomValidator);
}

export const bundle = async (
    txs: VersionedTransaction[],
    payer: Keypair,
    connection: Connection
) => {
    try {
        const jitoFeeWallet = getRandomValidatorKey();
        const latestBlockhash = await connection.getLatestBlockhash("confirmed");
        const jitTipTxFeeMessage = new TransactionMessage({
            payerKey: payer.publicKey,
            recentBlockhash: latestBlockhash.blockhash,
            instructions: [
                SystemProgram.transfer({
                    fromPubkey: payer.publicKey,
                    toPubkey: jitoFeeWallet,
                    lamports: Math.floor(JITO_FEE),
                }),
            ],
        }).compileToV0Message();
        const jitoFeeTx = new VersionedTransaction(jitTipTxFeeMessage);
        jitoFeeTx.sign([payer]);
        const jitoTxsignature = bs58.encode(jitoFeeTx.signatures[0]);
        // Serialize the transactions once here
        const serializedJitoFeeTx = bs58.encode(jitoFeeTx.serialize());
        const serializedTransactions = [serializedJitoFeeTx, ...txs.map((tx: VersionedTransaction) => bs58.encode(tx.serialize()))];
        // https://jito-labs.gitbook.io/mev/searcher-resources/json-rpc-api-reference/url
        const endpoints = [
            // 'https://mainnet.block-engine.jito.wtf/api/v1/bundles',
            // 'https://amsterdam.mainnet.block-engine.jito.wtf/api/v1/bundles',
            // 'https://frankfurt.mainnet.block-engine.jito.wtf/api/v1/bundles',
            'https://ny.mainnet.block-engine.jito.wtf/api/v1/bundles',
            // 'https://tokyo.mainnet.block-engine.jito.wtf/api/v1/bundles',
        ];
        
        const requests = endpoints.map((url) =>
            axios.post(url, {
                jsonrpc: '2.0',
                id: 1,
                method: 'sendBundle',
                params: [serializedTransactions],
            })
        );
        const results = await Promise.all(requests.map((p) => p.catch((e) => e)));

        const successfulResults = results.filter((result) => !(result instanceof Error));
        if (successfulResults.length > 0) {
            const confirmation = await connection.confirmTransaction({
                signature: jitoTxsignature,
                blockhash: latestBlockhash.blockhash,
                lastValidBlockHeight: latestBlockhash.lastValidBlockHeight
            }, "confirmed");
            if (confirmation.value.err)
                return 0;
            txs.map((tx) => console.log(`TX Confirmed: https://solscan.io/tx/${bs58.encode(tx.signatures[0])}`));
            return jitoTxsignature;
        } else {
            console.log(`No successful responses received for jito`);
        }
        return 0;
    } catch (error) {
        console.log('Error during transaction execution', error);
        return 0;
    }
}

export function calculateTotalAccountSize(
    individualAccountSize: number,
    accountHeaderSize: number,
    length: number
) {
    const accountPadding = 12;
    const minRequiredSize =
        accountPadding + accountHeaderSize + length * individualAccountSize;

    const modulo = minRequiredSize % 8;

    return modulo <= 4
        ? minRequiredSize + (4 - modulo)
        : minRequiredSize + (8 - modulo + 4);
}

const EVENT_QUEUE_LENGTH = 2978;
const EVENT_SIZE = 88;
const EVENT_QUEUE_HEADER_SIZE = 32;

const REQUEST_QUEUE_LENGTH = 63;
const REQUEST_SIZE = 80;
const REQUEST_QUEUE_HEADER_SIZE = 32;

const ORDERBOOK_LENGTH = 909;
const ORDERBOOK_NODE_SIZE = 72;
const ORDERBOOK_HEADER_SIZE = 40;

export const TOTAL_EVENT_QUEUE_SIZE = calculateTotalAccountSize(
    128,
    EVENT_QUEUE_HEADER_SIZE,
    EVENT_SIZE
)

export const TOTAL_REQUEST_QUEUE_SIZE = calculateTotalAccountSize(
    10,
    REQUEST_QUEUE_HEADER_SIZE,
    REQUEST_SIZE
)

export const TOTAL_ORDER_BOOK_SIZE = calculateTotalAccountSize(
    201,
    ORDERBOOK_HEADER_SIZE,
    ORDERBOOK_NODE_SIZE
)
