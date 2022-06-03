const { ethers, deployments, getUnnamedAccounts, network } = require('hardhat');
const { expect } = require("chai");


describe('LimeShop', () => {
    const CONTRACT_NAME = 'TechnoLimeShop';
    let technoLimeShop;

    let accounts;
    let owner;
    let nonOnwer1Address;

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

    const product3 = {
        name: "product3",
        quantity: 12,
        priceWei: 66,
        exists: true
    }

    beforeEach(async () => {
        await deployments.fixture([CONTRACT_NAME])
        technoLimeShop = await ethers.getContract(CONTRACT_NAME);

        accounts = await getUnnamedAccounts();
        owner = accounts[0];
        nonOnwer1Address = accounts[1];
    });

    it('should initialize Contract correctly', async () => {
        const startingIndex = await technoLimeShop.index();
        expect(startingIndex).to.equal(1);
    });

    describe('#addProduct', () => {
        it("should revert if NOT owner", async () => {
            await expect(technoLimeShop.connect(await ethers.getSigner(nonOnwer1Address)).addProduct(product1))
                .to.be.revertedWith('Ownable: caller is not the owner');
        });

        it('should add new product if does NOT exist', async () => {
            await technoLimeShop.addProduct(product1);
            await technoLimeShop.addProduct(product2);
            expect(await technoLimeShop.index()).to.equal(3);
        });

        it('should update quantity if product already exists', async () => {
            await technoLimeShop.addProduct(product1);
            await technoLimeShop.addProduct(product1);
            const prod = await technoLimeShop.getProductById(1);

            expect(await technoLimeShop.index()).to.equal(2);
            expect(prod.quantity.toNumber()).to.equal(product1.quantity * 2);
        });

        it("should revert if new product's quantity is < 1", async () => {
            const invalidQuantityProduct = Object.assign({}, product1, { quantity: 0 });
            await expect(technoLimeShop.addProduct(invalidQuantityProduct))
                .to.be.revertedWith('Quantity should be greater than 0');
        });


    });

    describe('#getProducts', () => {
        it('should list available products', async () => {
            await technoLimeShop.addProduct(product1);
            await technoLimeShop.addProduct(product2);
            await technoLimeShop.addProduct(product3);

            // buy all quantity from 2nd product, should be excluded from the result
            // more precisely, shown as an empty entry inside the array, which needs to be postprocessed clientside
            await technoLimeShop.buyProduct(2, product2.quantity,
                { value: product2.priceWei * product2.quantity })

            // in the result, there are gaps w/ empty entries. Filter them clientside 
            const productsList = (await technoLimeShop.getProducts())
                .filter(p => p.name.trim() != '');


            expect(productsList[0].name).to.equal(product1.name);
            expect(productsList[1].name).to.equal(product3.name);
        });
    });

    describe('#buyProduct', () => {
        const quantity = 3;
        let nonOwnerSigner;
        let nonOwnerSigner2;

        beforeEach(async () => {
            await technoLimeShop.addProduct(product1);
            await technoLimeShop.addProduct(product2);
            nonOwnerSigner = await ethers.getSigner(nonOnwer1Address);
            nonOwnerSigner2 = await ethers.getSigner(accounts[2]);
        });

        it('should revert if provided ETH is less than the price', async () => {
            await expect(technoLimeShop.connect(nonOwnerSigner)
                .buyProduct(1, quantity, { value: (product1.priceWei * quantity) - 100 }))
                .to.be.revertedWith("Provided ETH is less than the price!")
        });

        it('should buy the product correctly', async () => {
            const prod1Id = 1;
            const secondBuyerQuantity = 1;
            await technoLimeShop
                .connect(nonOwnerSigner)
                .buyProduct(prod1Id, quantity, { value: product1.priceWei * quantity });

            await technoLimeShop
                .connect(nonOwnerSigner2)
                .buyProduct(prod1Id, secondBuyerQuantity, { value: product1.priceWei * secondBuyerQuantity });


            // verify it's to the client's history
            expect(await technoLimeShop.clientToPurchasedProducts(nonOnwer1Address, prod1Id))
                .to.equal(quantity);

            expect(await technoLimeShop.clientToPurchasedProducts(accounts[2], prod1Id))
                .to.equal(secondBuyerQuantity);

            // verify product's quantity is reduced
            const boughtProduct = await technoLimeShop.getProductById(prod1Id);
            expect(boughtProduct.quantity.toNumber())
                .to.equal(product1.quantity - quantity - secondBuyerQuantity);

            // verify each product keeps a history for its buyers
            const productBuyers = await technoLimeShop.getProductBuyers(prod1Id);
            expect(productBuyers[0]).to.equal(nonOnwer1Address);
            expect(productBuyers[1]).to.equal(accounts[2]);
        });

        it("should revert if client buys more quantity than available", async () => {
            const exceedingQuantity = product1.quantity + 1;
            await expect(technoLimeShop
                .buyProduct(1, exceedingQuantity, { value: product1.priceWei * exceedingQuantity }))
                .to.be.revertedWith("There is no quantity avialable !")
        });
    });

    describe('#getProductBuyers', () => {
        it("should be able to see the addresses of all clients that have ever bought a given product.",
            async () => {
                await technoLimeShop.addProduct(product1);
                await technoLimeShop.addProduct(product2);

                await technoLimeShop.buyProduct(1, 2, { value: product1.priceWei * 2 });
                await technoLimeShop
                    .connect(await ethers.getSigner(accounts[1]))
                    .buyProduct(1, 2, { value: product1.priceWei * 2 });
                await technoLimeShop
                    .connect(await ethers.getSigner(accounts[2]))
                    .buyProduct(2, 1, { value: product2.priceWei });

                const product1Buyers = await technoLimeShop.getProductBuyers(1);
                const product2Buyers = await technoLimeShop.getProductBuyers(2);

                expect(product1Buyers.length).to.equal(2);
                expect(product1Buyers[0]).to.equal(accounts[0]);
                expect(product1Buyers[1]).to.equal(accounts[1]);

                expect(product2Buyers.length).to.equal(1);
                expect(product2Buyers[0]).to.equal(accounts[2]);

            })
    });
})