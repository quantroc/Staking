import { ethers } from "hardhat";

async function main() {
    const Staking = await ethers.getContractFactory("Staking");
    const staking = await Staking.deploy();

    await staking.deployed();

    console.log(staking.address);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});