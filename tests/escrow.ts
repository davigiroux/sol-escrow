import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Escrow } from "../target/types/escrow";
import { expect } from "chai";

describe("escrow", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.escrow as Program<Escrow>;

  it("program is initialized", () => {
    expect(program.programId).to.be.ok;
  });
});
