const { expect } = require("chai");
const { BigNumber } = require("ethers");
const { solidityKeccak256 } = require("ethers/lib/utils");
const { SignerWithAddress } = require("@nomiclabs/hardhat-ethers/signers");

async function deployRewardToken() {
  const RewardToken = await ethers.getContractFactory("RewardToken");
  const rewardToken = await RewardToken.deploy();
  rewardToken.deployed();
  return rewardToken;
}

async function deployStaking(rewardTokenAddress, rewardPerBlock) {
  const Staking = await ethers.getContractFactory("Staking");
  const staking = await Staking.deploy(rewardTokenAddress, rewardPerBlock);
  staking.deployed();
  return staking;
}

async function grantRewardTokenMinterRole(stakingAddress, rewardToken) {
  const transaction = await rewardToken.grantRole(
    solidityKeccak256(["string"], ["MINTER_ROLE"]),
    stakingAddress
  );
  return await transaction.wait();
}

async function createStakingPool(stakingAddress, stakeTokenAddress) {
  return await stakingAddress.createPool(stakeTokenAddress);
}

describe("Staking", function () {
  let rewardToken;
  let staking;
  let account1;
  let account2;
  const rewardPerBlock = ethers.utils.parseEther("4");
  this.beforeEach(async () => {
    rewardToken = await deployRewardToken();
    staking = await deployStaking(rewardToken.address, rewardPerBlock);
    await grantRewardTokenMinterRole(staking.address, rewardToken);
    [account1, account2] = await ethers.getSigners();
  });
  it("Create Pool", async function () {
    await expect(createStakingPool(staking, rewardToken.address))
      .to.emit(staking, "CreatePool")
      .withArgs(0);
  });

  it("Deposit a token in first pool", async function () {
    const stakeToken = rewardToken;
    await createStakingPool(staking, stakeToken.address);
    const amount = ethers.utils.parseEther("10");
    await stakeToken.approve(staking.address, amount);
    //action
    const depostTx = await staking.deposit(0, amount);
    //assert
    await expect(depostTx)
      .to.emit(staking, "Deposit") // gọi đến event của contract => contract staking, event Deposit
      .withArgs(account1.address, 0, amount); //event có 3 đối số(args) => so sánh đối số bằng withArgs với event
    const stakingBalance = await stakeToken.balanceOf(staking.address);
    expect(stakingBalance).to.be.equal(amount);
  });

  it("With draw all token ", async function () {
    const stakeToken = rewardToken;
    await createStakingPool(staking, stakeToken.address);
    const amount = 20;
    await stakeToken.approve(staking.address, amount);
    await staking.deposit(0, amount);
    //action
    const withdrawTx = await staking.withdraw(0);
    //assert
    await expect(withdrawTx)
      .to.emit(staking, "WithDraw")
      .withArgs(account1.address, 0, amount);
    const stakingBalance = await stakeToken.balanceOf(staking.address);
    expect(stakingBalance).to.be.equal(0);
  });

  it("Withdraw tokens and harvest rewards from a pool", async function () {
    const stakeToken = rewardToken;
    const account1PreviousBalance = await stakeToken.balanceOf(
      account1.address
    );
    await createStakingPool(staking, stakeToken.address);
    const amount = ethers.utils.parseEther("20");
    await stakeToken.approve(staking.address, amount);
    await staking.deposit(0, amount);
    const startingBlock = await ethers.provider.getBlockNumber();
    //action
    const withdrawTx = await staking.withdraw(0);
    //assert
    await expect(withdrawTx)
      .to.emit(staking, "WithDraw")
      .withArgs(account1.address, 0, amount);
    const stakingBalance = await stakeToken.balanceOf(staking.address);
    expect(stakingBalance).to.be.equal(0);
    const account1Balance = await stakeToken.balanceOf(account1.address);
    const endingBlockNumber = await ethers.provider.getBlockNumber();
    const blockPassed = endingBlockNumber - startingBlock;
    const rewards = rewardPerBlock.mul(blockPassed);
    const previousBalanceWithRewards = account1PreviousBalance.add(
      BigNumber.from(rewards)
    );
    expect(account1Balance).to.be.equal(previousBalanceWithRewards);
  });
  it("Harvest rewards according with the staker pool's share", async function () {
    // Arrange Pool
    const stakeToken = rewardToken;
    await stakeToken.transfer(
      account2.address,
      ethers.utils.parseEther("200000") // 200.000
    );
    await createStakingPool(staking, stakeToken.address);
    const amount1 = ethers.utils.parseEther("80");
    const amount2 = ethers.utils.parseEther("20");
    // Arrange Account1 staking
    await stakeToken.approve(staking.address, amount1);
    await staking.deposit(0, amount1);
    // Arrange Account 2 staking
    await stakeToken.connect(account2).approve(staking.address, amount2);
    await staking.connect(account2).deposit(0, amount2);
    // Act
    // await ethers.provider.send("evm_mine", []); // Mine a block
    const acc1HarvestTransaction = await staking.harvestReward(0);
    const acc2HarvestTransaction = await staking
      .connect(account2)
      .harvestReward(0);
    // Assert
    // 2 blocks with 100% participation = 4 reward tokens * 2 blocks = 8
    // 1 block with 80% participation = 3.2 reward tokens * 1 block = 3.2
    // Account1 Total = 8 + 3.2 = 11.2 reward tokens
    const expectedAccount1Rewards = ethers.utils.parseEther("11.2");
    await expect(acc1HarvestTransaction)
      .to.emit(staking, "HarvestReward")
      .withArgs(account1.address, 0, expectedAccount1Rewards);
    // 2 block with 20% participation = 0.8 reward tokens * 2 block
    // Account 1 Total = 1.6 reward tokens
    const expectedAccount2Rewards = ethers.utils.parseEther("1.6");
    await expect(acc2HarvestTransaction)
      .to.emit(staking, "HarvestReward")
      .withArgs(account2.address, 0, expectedAccount2Rewards);
  });
});
