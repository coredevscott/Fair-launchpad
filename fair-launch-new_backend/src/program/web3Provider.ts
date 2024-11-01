import * as anchor from "@coral-xyz/anchor"
import { PROGRAM_ID } from "./cli/programId"
import { ComputeBudgetProgram, Connection, PublicKey, SYSVAR_RENT_PUBKEY, SystemProgram, TransactionInstruction } from "@solana/web3.js"
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddress } from "@solana/spl-token"
import { AddLiquidityAccounts, AddLiquidityArgs, InitializeAccounts, InitializeArgs, RemoveLiquidityAccounts, RemoveLiquidityArgs, SwapAccounts, SwapArgs, addLiquidity, initialize, removeLiquidity, swap } from "./cli/instructions"
import { ASSOCIATED_PROGRAM_ID } from "@coral-xyz/anchor/dist/cjs/utils/token"
import {
  MarketV2,
  DEVNET_PROGRAM_ID,
  MAINNET_PROGRAM_ID,
  TxVersion,
  buildSimpleTransaction,
  Spl,
} from '@raydium-io/raydium-sdk';
import { adminKeypair } from "./web3"
import { TOTAL_EVENT_QUEUE_SIZE, TOTAL_ORDER_BOOK_SIZE, TOTAL_REQUEST_QUEUE_SIZE } from "./jito"

const curveSeed = "CurveConfiguration"
const POOL_SEED_PREFIX = "liquidity_pool"
const LP_SEED_PREFIX = "LiqudityProvider"



export const createLPIx = async (
  mintToken: PublicKey,
  payer: PublicKey,
  userpercent: number
) => {
  const [poolPda] = PublicKey.findProgramAddressSync(
    [Buffer.from(POOL_SEED_PREFIX), mintToken.toBuffer()],
    PROGRAM_ID
  )
  const [globalAccount] = PublicKey.findProgramAddressSync(
    [Buffer.from("global")],
    PROGRAM_ID
  );
  const [liquidityProviderAccount] = PublicKey.findProgramAddressSync(
    [Buffer.from(LP_SEED_PREFIX), poolPda.toBuffer(), payer.toBuffer()],
    PROGRAM_ID
  )
  const poolTokenOne = await getAssociatedTokenAddress(
    mintToken, globalAccount, true
  )
  const userAta1 = await getAssociatedTokenAddress(
    mintToken, payer
  )
  const acc: AddLiquidityAccounts = {
    pool: poolPda,
    globalAccount,
    mintTokenOne: mintToken,
    poolTokenAccountOne: poolTokenOne,
    userTokenAccountOne: userAta1,
    liquidityProviderAccount: liquidityProviderAccount,
    user: payer,
    tokenProgram: TOKEN_PROGRAM_ID,
    associatedTokenProgram: ASSOCIATED_PROGRAM_ID,
    rent: SYSVAR_RENT_PUBKEY,
    systemProgram: SystemProgram.programId
  }
  const args: AddLiquidityArgs = {
    amountOne: new anchor.BN(10000000000000*(100-userpercent)),
    amountTwo: new anchor.BN(30000000000)
  }
  const ix = addLiquidity(args, acc);

  return { ix, acc }
}
export const initializeIx = async (
  payer: PublicKey
) => {
  const [curveConfig] = PublicKey.findProgramAddressSync(
    [Buffer.from(curveSeed)],
    PROGRAM_ID
  );
  const [globalAccount] = PublicKey.findProgramAddressSync(
    [Buffer.from("global")],
    PROGRAM_ID
  );

  const acc: InitializeAccounts = {
    dexConfigurationAccount: curveConfig,
    globalAccount,
    admin: payer,
    rent: SYSVAR_RENT_PUBKEY,
    systemProgram: SystemProgram.programId
  };

  const args: InitializeArgs = {
    fee: 1
  }

  const ix = initialize(args, acc);
  return { ix, acc }

}

export const removeLiquidityIx = async (
  mintToken: PublicKey,
  // amountOne: anchor.BN,
  // amountTwo: anchor.BN,
  payer: PublicKey,
  connection: Connection,
  amount: number
) => {
  try {
    // const ammProgram = new PublicKey("HWy1jotHpo6UqeQxx49dpYYdQB8wj9Qk9MdxwjLvDHB8");
    const ammProgram = new PublicKey("675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8");

    //  coin mint address
    const coinMint = mintToken;
    //  coin mint address
    const pcMint = new PublicKey("So11111111111111111111111111111111111111112");
    //  market address
    const createMarketInstruments = await MarketV2.makeCreateMarketInstructionSimple({
      connection,
      wallet: payer,
      baseInfo: {mint: mintToken, decimals: 6},
      quoteInfo: {mint: pcMint, decimals: 9},
      lotSize: 1, // default 1
      tickSize: 0.01, // default 0.01
      // dexProgramId: DEVNET_PROGRAM_ID.OPENBOOK_MARKET,
      dexProgramId: MAINNET_PROGRAM_ID.OPENBOOK_MARKET,
      makeTxVersion,
      eventQueueSpacce: TOTAL_EVENT_QUEUE_SIZE,
      requestQueueSpacce: TOTAL_REQUEST_QUEUE_SIZE,
      orderbookQueueSpacce: TOTAL_ORDER_BOOK_SIZE 
    })
    
    const willSendTx = await buildSimpleTransaction({
      connection,
      makeTxVersion,
      payer,
      innerTransactions: createMarketInstruments.innerTransactions,
    })


    const market = createMarketInstruments.address.marketId;

    const [poolPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("liquidity_pool"), mintToken.toBuffer()],
      PROGRAM_ID
    )
    const [globalAccount] = PublicKey.findProgramAddressSync(
      [Buffer.from("global")],
      PROGRAM_ID
    )

    const [liquidityProviderAccount] = PublicKey.findProgramAddressSync(
      [Buffer.from("LiqudityProvider"), poolPda.toBuffer(), payer.toBuffer()],
      PROGRAM_ID
    )

    const [amm] = PublicKey.findProgramAddressSync(
      [ammProgram.toBuffer(), market.toBuffer(), Buffer.from("amm_associated_seed")],
      ammProgram
    );

    const [ammAuthority, nonce] = PublicKey.findProgramAddressSync(
      [Buffer.from("amm authority")],
      ammProgram
    );

    const [ammOpenOrders] = PublicKey.findProgramAddressSync(
      [ammProgram.toBuffer(), market.toBuffer(), Buffer.from("open_order_associated_seed")],
      ammProgram
    );

    const [lpMint] = PublicKey.findProgramAddressSync(
      [ammProgram.toBuffer(), market.toBuffer(), Buffer.from("lp_mint_associated_seed")],
      ammProgram
    );

    const [coinVault] = PublicKey.findProgramAddressSync(
      [ammProgram.toBuffer(), market.toBuffer(), Buffer.from("coin_vault_associated_seed")],
      ammProgram
    );

    const [pcVault] = PublicKey.findProgramAddressSync(
      [ammProgram.toBuffer(), market.toBuffer(), Buffer.from("pc_vault_associated_seed")],
      ammProgram
    );

    //  fee destination
    const feeDestination = new PublicKey("7YttLkHDoNj9wyDur5pM1ejNaAvT9X4eqaYcHQqtj2G5");

    const [targetOrders] = PublicKey.findProgramAddressSync(
      [ammProgram.toBuffer(), market.toBuffer(), Buffer.from("target_associated_seed")],
      ammProgram
    );

    const [ammConfig] = PublicKey.findProgramAddressSync(
      [Buffer.from("amm_config_account_seed")],
      ammProgram
    );

    const userWallet = new PublicKey("EmPsWiBxEy6rXNj3VVtHLNAmP5hUaVUrDH3QXiTttDgy");

    const userTokenCoin = await getAssociatedTokenAddress(
      coinMint, globalAccount, true
    )

    const userTokenPc = await getAssociatedTokenAddress(
      pcMint, globalAccount, true
    )

    const userTokenLp = await getAssociatedTokenAddress(
      lpMint, globalAccount, true
    )

    const ixs: TransactionInstruction[] = [];
    const newTokenAccount = await Spl.insertCreateWrappedNativeAccount({
      connection,
      owner: globalAccount,
      payer,
      instructions: ixs,
      instructionsType: [],
      signers: [adminKeypair],
      amount: new anchor.BN(10000000),
    });

    const acc: RemoveLiquidityAccounts = {
      pool: poolPda,
      globalAccount,
      ammProgram,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
      sysvarRent: SYSVAR_RENT_PUBKEY,
      amm,
      ammAuthority,
      ammOpenOrders,
      lpMint,
      coinMint,
      pcMint,
      coinVault,
      pcVault,
      targetOrders,
      ammConfig,
      feeDestination,
      // marketProgram: new PublicKey("EoTcMgcDRTJVZDMZWBoU6rhYHZfkNTVEAfz3uUJRcYGj"),
      marketProgram: new PublicKey("srmqPvymJeFKQ4zGQed1GFppgkRHL9kaELCbyksJtPX"),
      market,
      userWallet: payer,
      userTokenCoin,
      userTokenPc: newTokenAccount,
      userTokenLp,
    } 
    const args: RemoveLiquidityArgs = {
      nonce,
      initPcAmount: new anchor.BN(amount),
    }

    ixs.push(removeLiquidity(args, acc));

    // ixs.push(Spl.makeCloseAccountInstruction({
    //   programId: TOKEN_PROGRAM_ID,
    //   tokenAccount: newTokenAccount,
    //   owner: payer,
    //   payer,
    //   instructionsType: [],
    // }));

    return { ixs, acc, willSendTx }
  } catch (error) {
    console.log("Error in removing liquidity", error)
  }
}

export const makeTxVersion = TxVersion.LEGACY; // LEGACY 