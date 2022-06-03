// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";

contract TechnoLimeShop is Ownable {
    event ProductsAdded(Product[] _products);
    event QuantityUpdated(uint256 _id, uint256 _updatedQuantity);
    event ProductsBought(address indexed _buyer, uint256[] _id);
    event Refund(address _client, uint256 _prodId);

    struct ProductView {
        uint256 id;
        string name;
        uint256 quantity;
        uint256 priceWei;
    }

    struct Product {
        string name;
        uint256 quantity;
        uint256 priceWei;
        bool exists;
    }

    struct UpdateProduct {
        uint256 id;
        uint256 quantity;
    }

    struct OrderStatus {
        uint256 createdAtBlock;
        bool isBought;
        bool isRefunded;
    }

    uint256 private constant REFUND_MAX_BLOCKNUMBER = 100;

    // 0 is reserved for non-existing products
    uint256 public index = 1;

    mapping(uint256 => Product) public idToProduct;

    // if the name does NOT exist, 0 is returned
    mapping(string => uint256) nameToProductId;

    // client => (productId => OrderStatus)
    mapping(address => mapping(uint256 => OrderStatus))
        public clientToPurchasedProducts;

    mapping(uint256 => address[]) productIdToClients;

    function addProducts(Product[] calldata newProds) external onlyOwner {
        require(newProds.length > 0, "No products are provided !");

        for (uint256 i = 0; i < newProds.length; i++) {
            require(
                bytes(newProds[i].name).length > 0,
                "Product name is empty !"
            );
            require(
                nameToProductId[newProds[i].name] == 0,
                "Product with such name already exists !"
            );
            require(
                newProds[i].quantity > 0,
                "Quantity should be greater than 0 !"
            );
            require(newProds[i].priceWei >= 0, "Price cannot be negative !");
            addSingleProduct(newProds[i]);
        }

        emit ProductsAdded(newProds);
    }

    function updateProducts(UpdateProduct[] calldata prods) external onlyOwner {
        require(prods.length > 0, "No products are provided !");

        for (uint256 i = 0; i < prods.length; i++) {
            require(prods[i].id > 0, "Invalid id !");
            require(
                prods[i].quantity > 0,
                "Quantity should be greater than 0 !"
            );
            require(
                idToProduct[prods[i].id].exists,
                "Product with such id does not exist"
            );

            Product storage product = idToProduct[prods[i].id];
            product.quantity += prods[i].quantity;

            emit QuantityUpdated(prods[i].id, product.quantity);
        }
    }

    function buyProducts(uint256[] calldata ids) external payable {
        // max number of purchases can be added
        require(ids.length > 0, "No ids are provided");
        uint256 totalPrice = getTotalPrice(ids);
        // tips are accepted
        require(msg.value >= totalPrice, "Not enough ETH are provided !");

        for (uint256 i = 0; i < ids.length; i++) {
            uint256 prodId = ids[i];
            require(
                !clientToPurchasedProducts[msg.sender][prodId].isBought,
                "The client already bought that product !"
            );
            require(
                idToProduct[prodId].quantity > 0,
                "There is no quantity available !"
            );

            buySingleProduct(prodId);
        }

        emit ProductsBought(msg.sender, ids);
    }

    function refundProduct(uint256 prodId) public {
        OrderStatus storage orderStatus = clientToPurchasedProducts[msg.sender][
            prodId
        ];

        require(orderStatus.isBought, "You never bought that product !");
        require(!orderStatus.isRefunded, "You already refunded that product !");
        require(
            orderStatus.createdAtBlock + REFUND_MAX_BLOCKNUMBER >= block.number,
            "Refund period of 100 blocks is expired !"
        );

        Product storage product = idToProduct[prodId];
        product.quantity++;
        orderStatus.isRefunded = true;

        payable(msg.sender).transfer(product.priceWei);

        emit Refund(msg.sender, prodId);
    }

    function getTotalPrice(uint256[] memory ids)
        private
        view
        returns (uint256)
    {
        uint256 totalPrice = 0;
        for (uint256 i = 0; i < ids.length; i++) {
            if (idToProduct[ids[i]].exists) {
                totalPrice += idToProduct[ids[i]].priceWei;
            } else {
                revert("product with such id does not exist");
            }
        }
        return totalPrice;
    }

    function addSingleProduct(Product memory newProduct) private onlyOwner {
        Product memory product = Product(
            newProduct.name,
            newProduct.quantity,
            newProduct.priceWei,
            true
        );

        nameToProductId[product.name] = index;
        idToProduct[index] = product;
        index++;
    }

    function buySingleProduct(uint256 productId) private {
        OrderStatus memory order = OrderStatus({
            createdAtBlock: block.number,
            isBought: true,
            isRefunded: false
        });

        idToProduct[productId].quantity--;
        clientToPurchasedProducts[msg.sender][productId] = order;
        productIdToClients[productId].push(msg.sender);
    }

    function getProducts() public view returns (ProductView[] memory) {
        ProductView[] memory result = new ProductView[](index - 1);
        for (uint256 i = 0; i < index - 1; i++) {
            // because of unavailable products, some gaps with empty objects will be available,
            // would be cheaper if postprocess them client/backend side
            Product memory ogProduct = idToProduct[i + 1];
            if (ogProduct.quantity > 0) {
                ProductView memory curr = ProductView(
                    i + 1,
                    ogProduct.name,
                    ogProduct.quantity,
                    ogProduct.priceWei
                );
                result[i] = curr;
            }
        }
        return result;
    }

    /* Everyone should be able to see the addresses of all clients
         that have ever bought a given product. */
    function getProductBuyers(uint256 productId)
        public
        view
        returns (address[] memory)
    {
        require(
            idToProduct[productId].exists,
            "Product with such ID does NOT exist !"
        );

        return productIdToClients[productId];
    }
}
