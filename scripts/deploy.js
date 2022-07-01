import { ethers } from "hardhat";

async function main() {
    const Staking = await ethers.getContractFactory("Staking");
    const staking = await Staking.deploy("0x7d96Af8B11d2F987e702313df9cc1FdEBdAc0986",20);

    await staking.deployed();

    console.log(staking.address);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});