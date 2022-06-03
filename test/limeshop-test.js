const { ethers, deployments, getUnnamedAccounts, network } = require('hardhat');
const { expect } = require("chai");


describe('LimeShop', () => {
    const CONTRACT_NAME = 'TechnoLimeShop';
    let technoLimeShop;

    let accounts;
    let owner;
    let notOnwer1;

    beforeEach(async () => {
        await deployments.fixture([CONTRACT_NAME])
        technoLimeShop = await ethers.getContract(CONTRACT_NAME);

        accounts = await getUnnamedAccounts();
        owner = accounts[0];
        notOnwer1 = accounts[1];
    });

    it('should initialize Contract correctly', async () => {
        const startingIndex = await technoLimeShop.index();
        expect(startingIndex).to.equal(1);
    });

    describe('#addProduct', () => {

        const product1 = {
            name: "product1",
            quantity: 5,
            priceWei: 500,
            exists: true
        };

        const product2 = {
            name: "product2",
            quantity: 3,
            priceWei: 1200,
            exists: true
        }

        it("should revert if NOT owner", async () => {
            await expect(technoLimeShop.connect(await ethers.getSigner(notOnwer1)).addProduct(product1))
                .to.be.revertedWith('Ownable: caller is not the owner');
        });

        it('should add new product if NOT existing', async () => {
            await technoLimeShop.addProduct(product1);
            await technoLimeShop.addProduct(product2);
            expect(await technoLimeShop.index()).to.equal(3);
        });

        it('should update quantity if product DO exist', async () => {
            await technoLimeShop.addProduct(product1);
            await technoLimeShop.addProduct(product1);
            const prod = await technoLimeShop.getProductById(1);

            expect(await technoLimeShop.index()).to.equal(2);
            expect(prod.quantity.toNumber()).to.equal(product1.quantity * 2);
        });

        it("should revert if new product's quantity is < 1", async () => {
            const invalidQuantityProduct = Object.assign(product1, { quantity: 0 });
            await expect(technoLimeShop.addProduct(invalidQuantityProduct))
                .to.be.revertedWith('Quantity should be greater than 0');
        });


    });
})