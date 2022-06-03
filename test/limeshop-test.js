const { ethers, deployments, getUnnamedAccounts, network } = require('hardhat');
const { expect } = require("chai");


describe('LimeShop', () => {
    const CONTRACT_NAME = 'TechnoLimeShop';
    let technoLimeShop;

    beforeEach(async () => {
        await deployments.fixture([CONTRACT_NAME])
    });

    it('should be initialized correctly', async () => {
        limeShop = await ethers.getContract(CONTRACT_NAME);
        expect(await limeShop.index()).to.equal(0);
    });
})