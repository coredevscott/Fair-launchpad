use anchor_lang::prelude::*;

pub mod errors;
pub mod instructions;
pub mod state;
pub mod utils;

use crate::instructions::*;

declare_id!("6fDcuCmcBiJepAQkboGpVC4icLbeSMX88UMTwNDLGM5z");

#[program]
pub mod pump {
    use super::*;

    pub fn initialize(_ctx: Context<InitializeCurveConfiguration>) -> Result<()> {
        Ok(())
    }

    pub fn add_liquidity(
        ctx: Context<AddLiquidity>,
        amount_one: u64,
        amount_two: u64,
    ) -> Result<()> {
        instructions::add_liquidity(ctx, amount_one, amount_two)
    }

    pub fn swap(ctx: Context<Swap>, amount: u64, style: u64) -> Result<()> {
        instructions::swap(ctx, amount, style)
    }
    
    pub fn remove_liquidity(
        ctx: Context<RemoveLiquidity>,
        nonce: u8,
        init_pc_amount: u64,
    ) -> Result<()> {
        instructions::remove_liquidity(ctx, nonce, init_pc_amount)
    }

}