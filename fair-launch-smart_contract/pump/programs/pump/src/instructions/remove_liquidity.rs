use anchor_lang::{prelude::*, solana_program::program::invoke_signed};
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{Mint, Token},
};

use crate::state::{LiquidityPool, LiquidityPoolAccount};
use raydium_contract_instructions::amm_instruction;

pub fn remove_liquidity(
    ctx: Context<RemoveLiquidity>,
    nonce: u8,
    init_pc_amount: u64,
) -> Result<()> {

    let pool = &mut ctx.accounts.pool;

    let opentime = Clock::get()?.unix_timestamp as u64;
    let coin_amount = (init_pc_amount as u128 * pool.reserve_one as u128 / pool.reserve_two as u128) as u64; 

    let seeds = &[
        "global".as_bytes(), 
        &[ctx.bumps.global_account]
    ];
    let signed_seeds = &[&seeds[..]];

    msg!("Running raydium amm initialize2");
    let initialize_ix = amm_instruction::initialize2(
        ctx.accounts.amm_program.key,
        ctx.accounts.amm.key,
        ctx.accounts.amm_authority.key,
        ctx.accounts.amm_open_orders.key,
        ctx.accounts.lp_mint.key,
        &ctx.accounts.coin_mint.key(),
        &ctx.accounts.pc_mint.key(),
        ctx.accounts.coin_vault.key,
        ctx.accounts.pc_vault.key,
        ctx.accounts.target_orders.key,
        ctx.accounts.amm_config.key,
        ctx.accounts.fee_destination.key,
        ctx.accounts.market_program.key,
        ctx.accounts.market.key,
        //  change this to PDA address
        ctx.accounts.global_account.key,
        ctx.accounts.user_token_coin.key,
        ctx.accounts.user_token_pc.key,
        &ctx.accounts.user_token_lp.key(),
        nonce,
        opentime,
        init_pc_amount,
        coin_amount,
    )?;
    let account_infos = [
        ctx.accounts.amm_program.clone(),
        ctx.accounts.amm.clone(),
        ctx.accounts.amm_authority.clone(),
        ctx.accounts.amm_open_orders.clone(),
        ctx.accounts.lp_mint.clone(),
        ctx.accounts.coin_mint.to_account_info().clone(),
        ctx.accounts.pc_mint.to_account_info().clone(),
        ctx.accounts.coin_vault.clone(),
        ctx.accounts.pc_vault.clone(),
        ctx.accounts.target_orders.clone(),
        ctx.accounts.amm_config.clone(),
        ctx.accounts.fee_destination.clone(),
        ctx.accounts.market_program.clone(),
        ctx.accounts.market.clone(),
        ctx.accounts.global_account.clone(),
        ctx.accounts.user_token_coin.clone(),
        ctx.accounts.user_token_pc.clone(),
        ctx.accounts.user_token_lp.clone(),
        ctx.accounts.token_program.to_account_info().clone(),
        ctx.accounts.system_program.to_account_info().clone(),
        ctx.accounts
            .associated_token_program
            .to_account_info()
            .clone(),
        ctx.accounts.sysvar_rent.to_account_info().clone(),
    ];
    invoke_signed(&initialize_ix, &account_infos, signed_seeds)?;

    msg!("Reserve:: Token: {:?}  Sol: {:?}", pool.reserve_one, pool.reserve_two);
    msg!("Raydium Input:: Token: {:?}  Sol: {:?}", coin_amount, init_pc_amount);
    
    pool.transfer_sol_from_pool(
        &ctx.accounts.global_account,
        &ctx.accounts.fee_destination,
        pool.reserve_two - init_pc_amount, 
        &ctx.accounts.system_program,
        ctx.bumps.global_account
    )?;

    pool.update_reserves(0, 0)?;

    Ok(())
}

#[derive(Accounts)]
pub struct RemoveLiquidity<'info> {
    #[account(
        mut,
        seeds = [LiquidityPool::POOL_SEED_PREFIX.as_bytes(), coin_mint.key().as_ref()],
        bump = pool.bump
    )]
    pub pool: Box<Account<'info, LiquidityPool>>,

    /// CHECK
    #[account(
        mut,
        seeds = [b"global"],
        bump,
    )]
    pub global_account: AccountInfo<'info>,

    /// CHECK: Safe
    pub amm_program: AccountInfo<'info>,
    /// CHECK: Safe. The spl token program
    pub token_program: Program<'info, Token>,
    /// CHECK: Safe. The associated token program
    pub associated_token_program: Program<'info, AssociatedToken>,
    /// CHECK: Safe. System program
    pub system_program: Program<'info, System>,
    /// CHECK: Safe. Rent program
    pub sysvar_rent: Sysvar<'info, Rent>,
    /// CHECK: Safe.
    #[account(
        mut,
        seeds = [
            amm_program.key.as_ref(),
            market.key.as_ref(),
            b"amm_associated_seed"],
        bump,
        seeds::program = amm_program.key
    )]
    pub amm: AccountInfo<'info>,
    /// CHECK: Safe
    #[account(
        seeds = [b"amm authority"],
        bump,
        seeds::program = amm_program.key
    )]
    pub amm_authority: AccountInfo<'info>,
    /// CHECK: Safe
    #[account(
        mut,
        seeds = [
            amm_program.key.as_ref(),
            market.key.as_ref(),
            b"open_order_associated_seed"],
        bump,
        seeds::program = amm_program.key
    )]
    pub amm_open_orders: AccountInfo<'info>,
    /// CHECK: Safe
    #[account(
        mut,
        seeds = [
            amm_program.key.as_ref(),
            market.key.as_ref(),
            b"lp_mint_associated_seed"
        ],
        bump,
        seeds::program = amm_program.key
    )]
    pub lp_mint: AccountInfo<'info>,

    #[account(mut)]
    pub coin_mint: Box<Account<'info, Mint>>,
    /// CHECK: Safe. Pc mint account
    #[account(mut)]
    pub pc_mint: Box<Account<'info, Mint>>,
    /// CHECK: Safe
    #[account(
        mut,
        seeds = [
            amm_program.key.as_ref(),
            market.key.as_ref(),
            b"coin_vault_associated_seed"
        ],
        bump,
        seeds::program = amm_program.key
    )]
    pub coin_vault: AccountInfo<'info>,
    /// CHECK: Safe
    #[account(
        mut,
        seeds = [
            amm_program.key.as_ref(),
            market.key.as_ref(),
            b"pc_vault_associated_seed"
        ],
        bump,
        seeds::program = amm_program.key
    )]
    pub pc_vault: AccountInfo<'info>,
    /// CHECK: Safe
    #[account(
        mut,
        seeds = [
            amm_program.key.as_ref(),
            market.key.as_ref(),
            b"target_associated_seed"
        ],
        bump,
        seeds::program = amm_program.key
    )]
    pub target_orders: AccountInfo<'info>,
    /// CHECK: Safe
    #[account(
        mut,
        seeds = [b"amm_config_account_seed"],
        bump,
        seeds::program = amm_program.key
    )]
    pub amm_config: AccountInfo<'info>,
    /// CHECK: Safe
    #[account(mut)]
    pub fee_destination: AccountInfo<'info>,
    /// CHECK: Safe. OpenBook program.
    pub market_program: AccountInfo<'info>,
    /// CHECK: Safe. OpenBook market. OpenBook program is the owner.
    #[account(
       mut
    )]
    pub market: AccountInfo<'info>,
    /// CHECK: Safe. The user wallet create the pool
    #[account(mut)]
    pub user_wallet: Signer<'info>,
    /// CHECK: Safe. The user coin token
    #[account(
        mut,
    )]
    pub user_token_coin: AccountInfo<'info>,
    /// CHECK: Safe. The user pc token
    #[account(
        mut,
    )]
    pub user_token_pc: AccountInfo<'info>,
    /// CHECK: Safe. The user lp token
    #[account(
        mut,
    )]
    pub user_token_lp: AccountInfo<'info>,
}
