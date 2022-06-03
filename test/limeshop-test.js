const { ethers, deployments, getUnnamedAccounts, network, waffle } = require('hardhat');
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
        quantity: 2,
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
            await expect(technoLimeShop.connect(await ethers.getSigner(nonOnwer1Address))
                .addProducts([product1])
            ).to.be.revertedWith('Ownable: caller is not the owner');
        });

        it('should add new products if they do NOT exist', async () => {
            await technoLimeShop.addProducts([product1, product2]);

            const products = await technoLimeShop.getProducts();
            expect(products.length).to.equal(2);
            expect(products[0].name).to.equal(product1.name);
            expect(products[1].name).to.equal(product2.name);
            expect(await technoLimeShop.index()).to.equal(3);
        });

        it('should update quantity if product already exists', async () => {
            await technoLimeShop.addProducts([product1, product1]);
            const prod = await technoLimeShop.idToProduct(1);

            expect(await technoLimeShop.index()).to.equal(2);
            expect(prod.quantity.toNumber()).to.equal(product1.quantity * 2);
        });

        it("should revert if no products are provided", async () => {
            await expect(technoLimeShop.addProducts([]))
                .to.be.revertedWith("No products are provided !");
        })

        it("should revert if new product's quantity is < 1", async () => {
            const invalidQuantityProduct = Object.assign({}, product1, { quantity: 0 });
            await expect(technoLimeShop.addProducts([product1, invalidQuantityProduct]))
                .to.be.revertedWith('Quantity should be greater than 0');
        });

        it("should revert if new product's name is empty", async () => {
            const invalidNameProduct = Object.assign({}, product1, { name: '' });
            await expect(technoLimeShop.addProducts([product1, invalidNameProduct]))
                .to.be.revertedWith("Product name is empty !");
        });
    });

    describe('#getProducts', () => {
        it('should list available products', async () => {
            await technoLimeShop.addProducts([product1, product2, product3]);
            // buy all quantity from 2nd product, should be excluded from the result
            // more precisely, shown as an empty entry inside the array, which needs to be postprocessed clientside
            await technoLimeShop.buyProducts([2],
                { value: product2.priceWei })

            await technoLimeShop
                .connect(await ethers.getSigner(accounts[1]))
                .buyProducts([2], { value: product2.priceWei })

            // in the result, there are gaps w/ empty entries. Filter them clientside 
            const productsList = (await technoLimeShop.getProducts())
                .filter(p => p.name.trim() != '');


            expect(productsList[0].name).to.equal(product1.name);
            expect(productsList[1].name).to.equal(product3.name);
        });
    });

    describe('#buyProduct', () => {
        let nonOwnerSigner;
        let nonOwnerSigner2;

        beforeEach(async () => {
            await technoLimeShop.addProducts([product1, product2]);
            nonOwnerSigner = await ethers.getSigner(nonOnwer1Address);
            nonOwnerSigner2 = await ethers.getSigner(accounts[2]);
        });

        it('should revert if provided ETH is less than the price', async () => {
            await expect(technoLimeShop.connect(nonOwnerSigner)
                .buyProducts([1, 2], { value: (product1.priceWei + product2.priceWei) - 100 }))
                .to.be.revertedWith("Not enough ETH are provided !")
        });

        it('should buy the product correctly', async () => {
            const prod1Id = 1;
            // buy with 1st acc
            const acc1BuyTx = await technoLimeShop
                .connect(nonOwnerSigner)
                .buyProducts([prod1Id], { value: product1.priceWei });
            const acc1BlockNumber = acc1BuyTx.blockNumber;

            // buy with 2nd acc
            const acc2BuyTx = await technoLimeShop
                .connect(nonOwnerSigner2)
                .buyProducts([prod1Id], { value: product1.priceWei });

            const acc2BlockNumber = acc2BuyTx.blockNumber;

            // verify orderStatus creation
            const acc1OrderStatus = await technoLimeShop
                .clientToPurchasedProducts(nonOnwer1Address, prod1Id);
            expect(acc1OrderStatus.createdAtBlock).to.equal(acc1BlockNumber);
            expect(acc1OrderStatus.isBought).to.equal(true);
            expect(acc1OrderStatus.isRefunded).to.equal(false);

            const acc2OrderStatus = await technoLimeShop
                .clientToPurchasedProducts(accounts[2], prod1Id);

            expect(acc2OrderStatus.createdAtBlock).to.equal(acc2BlockNumber);
            expect(acc2OrderStatus.isBought).to.equal(true);
            expect(acc2OrderStatus.isRefunded).to.equal(false);

            // verify product's quantity is reduced
            const boughtProduct = await technoLimeShop.idToProduct(prod1Id);
            expect(boughtProduct.quantity.toNumber())
                .to.equal(product1.quantity - 2);

            // verify each product keeps a history for its buyers
            const productBuyers = await technoLimeShop.getProductBuyers(prod1Id);
            expect(productBuyers.length).to.equal(2);
            expect(productBuyers[0]).to.equal(nonOnwer1Address);
            expect(productBuyers[1]).to.equal(accounts[2]);
        });

        it('should revert if client already bought the same product', async () => {
            await technoLimeShop
                .buyProducts([1], { value: product1.priceWei });

            await expect(technoLimeShop
                .buyProducts([2, 1], { value: product1.priceWei + product2.priceWei }))
                .to.be.revertedWith("The client already bought that product !")
        });

        it("should revert if quantity is over", async () => {
            await technoLimeShop
                .buyProducts([2], { value: product2.priceWei });

            await technoLimeShop
                .connect(await ethers.getSigner(accounts[1]))
                .buyProducts([2], { value: product2.priceWei });

            await expect(technoLimeShop
                .connect(await ethers.getSigner(accounts[3]))
                .buyProducts([2], { value: product2.priceWei }))
                .to.be.revertedWith("There is no quantity available !")
        });
    });

    describe('#refundProduct', () => {
        beforeEach(async () => {
            await technoLimeShop.addProducts([product1]);
        })

        it('should revert if product was NOT bought beforehand', async () => {
            await expect(technoLimeShop.refundProduct(1))
                .to.be.revertedWith("You never bought that product !")
        });

        it('should revert if product was Refunded in the past', async () => {
            await technoLimeShop.buyProducts([1], { value: product1.priceWei });
            await technoLimeShop.refundProduct(1)

            await expect(technoLimeShop.refundProduct(1))
                .to.be.revertedWith("You already refunded that product !");
        });

        it('should revert if refund period of 100 blocks expired', async () => {
            await technoLimeShop.buyProducts([1], { value: product1.priceWei });
            // mine 101 blocks (0x65)
            // https://hardhat.org/hardhat-network/reference#hardhat-mine
            network.provider.send("hardhat_mine", ['0x65']);

            await expect(technoLimeShop.refundProduct(1))
                .to.be.revertedWith("Refund period of 100 blocks is expired !");
        });

        it('should update balances and quantity correctly', async () => {
            await technoLimeShop.buyProducts([1], { value: product1.priceWei });

            const fetchedProd1Before = await technoLimeShop.idToProduct(1);

            const provider = waffle.provider;
            const contractBalanceBeforeRefund = await provider.getBalance(technoLimeShop.address);

            await technoLimeShop.refundProduct(1);
            const fetchedProd1After = await technoLimeShop.idToProduct(1);

            // recover quantity
            expect(fetchedProd1After.quantity.toNumber())
                .to.be.equal(fetchedProd1Before.quantity.toNumber() + 1);

            // order set as refunded
            const orderStatus = await technoLimeShop.clientToPurchasedProducts(accounts[0], 1);
            expect(orderStatus.isRefunded).to.equal(true);

            // refunded to sender
            expect(await provider.getBalance(technoLimeShop.address))
                .to.equal(contractBalanceBeforeRefund - product1.priceWei);
        });
    });

    describe('#getProductBuyers', () => {
        it("should be able to see the addresses of all clients that have ever bought a given product.",
            async () => {
                await technoLimeShop.addProducts([product1, product2]);

                await technoLimeShop.buyProducts([1],
                    { value: product1.priceWei });
                await technoLimeShop
                    .connect(await ethers.getSigner(accounts[1]))
                    .buyProducts([1], { value: product1.priceWei });
                await technoLimeShop
                    .connect(await ethers.getSigner(accounts[2]))
                    .buyProducts([2], { value: product2.priceWei });

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