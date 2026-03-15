use anchor_lang::prelude::*;

pub mod state;

use state::Escrow;

declare_id!("Huid51EyAoXC4M1XLDDL756pRmmZZ1D7XCD3rowxX4hq");

#[program]
pub mod escrow {
    use super::*;

    pub fn make_escrow(
        _ctx: Context<MakeEscrow>,
        _seed: u64,
        _amount_a: u64,
        _amount_b: u64,
    ) -> Result<()> {
        // TODO: Phase 2
        Ok(())
    }

    pub fn take_escrow(_ctx: Context<TakeEscrow>) -> Result<()> {
        // TODO: Phase 2
        Ok(())
    }

    pub fn cancel_escrow(_ctx: Context<CancelEscrow>) -> Result<()> {
        // TODO: Phase 2
        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(seed: u64)]
pub struct MakeEscrow<'info> {
    #[account(mut)]
    pub maker: Signer<'info>,

    #[account(
        init,
        payer = maker,
        space = 8 + Escrow::INIT_SPACE,
        seeds = [b"escrow", maker.key().as_ref(), seed.to_le_bytes().as_ref()],
        bump,
    )]
    pub escrow: Account<'info, Escrow>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct TakeEscrow<'info> {
    #[account(mut)]
    pub taker: Signer<'info>,

    #[account(
        mut,
        close = maker,
        has_one = maker,
    )]
    pub escrow: Account<'info, Escrow>,

    /// CHECK: validated via has_one on escrow
    #[account(mut)]
    pub maker: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CancelEscrow<'info> {
    #[account(mut)]
    pub maker: Signer<'info>,

    #[account(
        mut,
        close = maker,
        has_one = maker,
    )]
    pub escrow: Account<'info, Escrow>,

    pub system_program: Program<'info, System>,
}
