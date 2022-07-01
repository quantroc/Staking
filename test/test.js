const { SignerWithAddress } =require("@nomiclabs/hardhat-ethers/dist/src/signer-with-address");
const { expect } = require("chai");
const { BigNumber } = require("ethers");
const { solidityKeccak256 } = require("ethers/lib/utils");
const { ethers } = require("hardhat");
describe("Staking contract", function () {
    let owner;
    let addr1;
    let addr2;
    let addrs;
    let staking;
    let RewardToken;
    let rewardToken;
    let Staking;

    beforeEach(async function () {
        [owner, addr1, addr2, ...addrs] = await ethers.getSigners();
        RewardToken = await ethers.getContractFactory("RewardToken");
        rewardToken = await RewardToken.deploy();
        Staking = await ethers.getContractFactory("Staking");
        staking = await Staking.deploy(rewardToken.address,20);      
    });


    describe("Deployment", function () {
        it("constructor", async function () {
          expect(await staking.owner()).to.equal(owner.address);
          expect(await staking.rewardTokensPerBlock()).to.equal(20);
        });

        it("create a new pool", async function () {
            await staking.createPool(rewardToken.address);
            //let pools = await staking.pools(0);
            expect(await staking.poolLength()).to.equal(1);
        });

        it("deposit a token in pool", async function () {
          const stakeToken = rewardToken;
          await staking.createPool(stakeToken.address);
          const amount = ethers.utils.parseEther("10");
          await stakeToken.approve(staking.address, amount);

          await staking.deposit(0, amount);
          await expect(stakeToken.balanceOf(staking.address)).to.equal(amount);
        })
      });
});



