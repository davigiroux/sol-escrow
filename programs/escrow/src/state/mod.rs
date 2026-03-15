use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct Escrow {
    pub maker: Pubkey,
    pub mint_a: Pubkey,
    pub mint_b: Pubkey,
    pub amount_a: u64,
    pub amount_b: u64,
    pub seed: u64,
    pub escrow_bump: u8,
    pub vault_bump: u8,
}
