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
        await rewardToken.transfer(addr1.address,2000);
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
          let stakeToken = rewardToken;
          await staking.createPool(rewardToken.address);
          await(await rewardToken.connect(addr1).approve(staking.address, 500));
          //console.log(await rewardToken.balanceOf(staking.address));
          await staking.connect(addr1).deposit(0, 500);
          console.log(await rewardToken.balanceOf(staking.address));
          expect(await rewardToken.balanceOf(staking.address)).to.equal(500);
        })

        it("withdraw all token from a pool", async function () {
          await staking.createPool(rewardToken.address);
          await( await rewardToken.connect(addr1).approve(staking.address,500));
          await staking.connect(addr1).deposit(0, 500);
          expect(await rewardToken.balanceOf(staking.address)).to.eq(500);

          await staking.connect(addr1).withdraw(0);
          expect(await rewardToken.balanceOf(staking.address)).to.eq(0);
        });
      });
});



