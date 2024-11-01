import { ComputeBudgetProgram, Connection, Keypair, PublicKey, SYSVAR_RENT_PUBKEY, Signer, SystemProgram, Transaction, TransactionResponse, VersionedTransaction, clusterApiUrl, sendAndConfirmTransaction } from "@solana/web3.js";
import { PROGRAM_ID } from "./cli/programId";
import { AccountType, TOKEN_PROGRAM_ID, getAssociatedTokenAddress , ASSOCIATED_TOKEN_PROGRAM_ID} from "@solana/spl-token";
import { SwapAccounts, SwapArgs, swap } from "./cli/instructions/swap";
import * as anchor from "@coral-xyz/anchor"
import { ASSOCIATED_PROGRAM_ID } from "@coral-xyz/anchor/dist/cjs/utils/token";
import { WalletContextState, useConnection, useWallet } from '@solana/wallet-adapter-react';
import { errorAlert } from "@/components/ToastGroup";

const curveSeed = "CurveConfiguration"
const POOL_SEED_PREFIX = "liquidity_pool"

export const connection = new Connection("https://rpc.shyft.to?api_key=lSeaxDG9Hh48hWcq")
// export const connection = new Connection("https://white-aged-glitter.solana-mainnet.quiknode.pro/743d4e1e3949c3127beb7f7815cf2ca9743b43a6")

// const privateKey = base58.decode(process.env.PRIVATE_KEY!);

// export const adminKeypair = web3.Keypair.fromSecretKey(privateKey);
// const adminWallet = new NodeWallet(adminKeypair);

export const getTokenBalance = async (
  walletAddress: string,
  tokenMintAddress: string
) => {
    const wallet = new PublicKey(walletAddress);
    const tokenMint = new PublicKey(tokenMintAddress);

    // Fetch the token account details
    const response = await connection.getTokenAccountsByOwner(wallet, {
        mint: tokenMint,
    });

    if (response.value.length == 0) {
        console.log("No token account found for the specified mint address.");
        return;
    }

    // Get the balance
    const tokenAccountInfo = await connection.getTokenAccountBalance(response.value[0].pubkey);

    // Convert the balance from integer to decimal format
    console.log(`Token Balance: ${tokenAccountInfo.value.uiAmount}`);

    return tokenAccountInfo.value.uiAmount;
}
// Send Fee to the Fee destination
export const creatFeePay = async (
  wallet: WalletContextState,
  amount: number
) => {
    console.log("========Fee Pay==============")
    // check the connection
    if (!wallet.publicKey || !connection) {
        console.log("Error: Wallet not connected")
        return "WalletError";
    }
    let solAmt = 0;
    const toWallet = new PublicKey("FMkyrmt9Uo575MDFGAovfDsv2Tht4akLs1mXbxPPqauf");

    console.log("Amount:   ", amount, Number(amount),"     : Types:   ", typeof(amount));
    if (amount !== undefined) solAmt = Math.floor((0.02 + Number(amount)) * Math.pow(10, 9)); 

    try {

      const balance = await connection.getBalance(wallet.publicKey);
      if (balance <= solAmt) {
        console.log("Error: Not enough SOL balance to create coin");
        return "NotEnoughBalance";
      }

      const transaction = new Transaction().add(
        ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 100_000 }),
        SystemProgram.transfer({
            fromPubkey: wallet.publicKey,
            toPubkey: toWallet,
            lamports: solAmt // 1 SOL (Solana has 9 decimal places)
        })
      );

      transaction.feePayer = wallet.publicKey
      const blockhash = await connection.getLatestBlockhash()

      transaction.recentBlockhash = blockhash.blockhash

      if (wallet.signTransaction) {
          const signedTx = await wallet.signTransaction(transaction)
          const sTx = signedTx.serialize();
          console.log("----",  await connection.simulateTransaction(signedTx));
          const signature = await connection.sendRawTransaction(sTx, { preflightCommitment: "confirmed", skipPreflight: false, maxRetries: 2 })

          const res = await connection.confirmTransaction({
              signature,
              blockhash: blockhash.blockhash,
              lastValidBlockHeight: blockhash.lastValidBlockHeight
          }, "confirmed");
          console.log("Successfully initialized.\n Signature: ", signature);
          return res;
      }
    } catch (error) {
      console.log("----", error);
      return "RejectSolPay"

    }
}
// Swap transaction
export const swapTx = async (
    mint1: PublicKey, wallet: WalletContextState, amount: string , type: number
):Promise<any> => {
    console.log("========trade swap==============")
    // check the connection
    if (!wallet.publicKey || !connection) {
        console.log("Warning: Wallet not connected")
        return
    }

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

        console.log(poolTokenOne.toBase58(), "=====");

        const {instructions, destinationAccounts} = await getATokenAccountsNeedCreate(connection, wallet.publicKey, wallet.publicKey, [mint1])


        console.log(amount, "====", typeof(amount))
        const args: SwapArgs = {
            amount: new anchor.BN(type===2 ? parseFloat(amount)*1000_000_000 : parseFloat(amount)*1_000_000),
            style: new anchor.BN(type)
        }

        const acc: SwapAccounts = {
            dexConfigurationAccount: curveConfig,
            pool: poolPda,
            globalAccount,
            mintTokenOne: mint1,
            poolTokenAccountOne: poolTokenOne,
            userTokenAccountOne: destinationAccounts[0],
            user: wallet.publicKey,
            tokenProgram: TOKEN_PROGRAM_ID,
            associatedTokenProgram: ASSOCIATED_PROGRAM_ID,
            rent: SYSVAR_RENT_PUBKEY,
            systemProgram: SystemProgram.programId
        }

        const dataIx =  swap(args, acc, PROGRAM_ID)
        const tx = new Transaction()
        if(instructions.length !== 0 ) tx.add(...instructions) 

        const updateCpIx = ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1_000_000 })
        const updateCuIx = ComputeBudgetProgram.setComputeUnitLimit({ units: 200_000 })

        tx.add(updateCpIx, updateCuIx, dataIx);
        tx.feePayer = wallet.publicKey
        tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash

        if (wallet.signTransaction) {
            const signedTx = await wallet.signTransaction(tx)
            const sTx = signedTx.serialize();
            console.log("----",  await connection.simulateTransaction(signedTx));
            const signature = await connection.sendRawTransaction(sTx, { preflightCommitment: "confirmed", skipPreflight: false })
            const blockhash = await connection.getLatestBlockhash()

            const res = await connection.confirmTransaction({
                signature,
                blockhash: blockhash.blockhash,
                lastValidBlockHeight: blockhash.lastValidBlockHeight
            }, "confirmed");
            console.log("Successfully initialized.\n Signature: ", signature);
            return res;
        }

        // const sig = await sendAndConfirmTransaction(connection, tx, [user], { skipPreflight: true })
        // return sig
    } catch (error) {
        console.log("Error in swap transaction", error)
    }
}


const getAssociatedTokenAccount = async (
  ownerPubkey: PublicKey,
  mintPk: PublicKey
): Promise<PublicKey> => {
  let associatedTokenAccountPubkey = PublicKey.findProgramAddressSync(
    [
      ownerPubkey.toBuffer(),
      TOKEN_PROGRAM_ID.toBuffer(),
      mintPk.toBuffer(), // mint address
    ],
    ASSOCIATED_TOKEN_PROGRAM_ID
  )[0];

  return associatedTokenAccountPubkey;
};

const createAssociatedTokenAccountInstruction = (
  associatedTokenAddress: anchor.web3.PublicKey,
  payer: anchor.web3.PublicKey,
  walletAddress: anchor.web3.PublicKey,
  splTokenMintAddress: anchor.web3.PublicKey
) => {
  const keys = [
    { pubkey: payer, isSigner: true, isWritable: true },
    { pubkey: associatedTokenAddress, isSigner: false, isWritable: true },
    { pubkey: walletAddress, isSigner: false, isWritable: false },
    { pubkey: splTokenMintAddress, isSigner: false, isWritable: false },
    {
      pubkey: anchor.web3.SystemProgram.programId,
      isSigner: false,
      isWritable: false,
    },
    { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    {
      pubkey: anchor.web3.SYSVAR_RENT_PUBKEY,
      isSigner: false,
      isWritable: false,
    },
  ];
  return new anchor.web3.TransactionInstruction({
    keys,
    programId: ASSOCIATED_TOKEN_PROGRAM_ID,
    data: Buffer.from([]),
  });
};

const getATokenAccountsNeedCreate = async (
  connection: anchor.web3.Connection,
  walletAddress: anchor.web3.PublicKey,
  owner: anchor.web3.PublicKey,
  nfts: anchor.web3.PublicKey[]
) => {
  let instructions = [],
    destinationAccounts = [];
  for (const mint of nfts) {
    const destinationPubkey = await getAssociatedTokenAccount(owner, mint);
    let response = await connection.getAccountInfo(destinationPubkey);
    if (!response) {
      const createATAIx = createAssociatedTokenAccountInstruction(
        destinationPubkey,
        walletAddress,
        owner,
        mint
      );
      instructions.push(createATAIx);
    }
    destinationAccounts.push(destinationPubkey);
    if (walletAddress != owner) {
      const userAccount = await getAssociatedTokenAccount(walletAddress, mint);
      response = await connection.getAccountInfo(userAccount);
      if (!response) {
        const createATAIx = createAssociatedTokenAccountInstruction(
          userAccount,
          walletAddress,
          walletAddress,
          mint
        );
        instructions.push(createATAIx);
      }
    }
  }
  return {
    instructions,
    destinationAccounts,
  };
};

