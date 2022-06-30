const { SignerWithAddress } =require("@nomiclabs/hardhat-ethers/dist/src/signer-with-address");
const { expect } = require("chai");
const { BigNumber } = require("ethers");
const { solidityKeccak256 } = require("ethers/lib/utils");
const { ethers } = require("hardhat");
describe("Staking contract", function () {


    beforeEach(async function () {
        const RewardToken = await ethers.getContractFactory("RewardToken");
    })
})
