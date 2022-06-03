//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";

contract TechnoLimeShop is Ownable {
    event ProductAdded(Product _product);
    event QuantityUpdated(uint256 _id, uint256 _updatedQuantity);
    event ProductsBought(address indexed _buyer, uint256[] _id);
    event Refund(address _client, uint256 _prodId);

    struct Product {
        string name;
        uint256 quantity;
        uint256 priceWei;
        bool exists;
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

    // if this function is marked as external,
    // the product argument can be calldata (cheaper)
    function addProduct(Product memory newProduct) public onlyOwner {
        require(newProduct.quantity > 0, "Quantity should be greater than 0");
        uint256 productId = nameToProductId[newProduct.name];
        if (idToProduct[productId].exists) {
            // product exists, update quantity only
            Product storage product = idToProduct[productId];
            product.quantity += newProduct.quantity;

            emit QuantityUpdated(productId, product.quantity);
        } else {
            // product does not exist, add it
            Product memory product = Product(
                newProduct.name,
                newProduct.quantity,
                newProduct.priceWei,
                true
            );

            nameToProductId[product.name] = index;
            idToProduct[index] = product;
            index++;
            emit ProductAdded(product);
        }
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

    function buyProducts(uint256[] memory ids) public payable {
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

    function getProducts() public view returns (Product[] memory) {
        Product[] memory result = new Product[](index - 1);
        for (uint256 i = 0; i < index - 1; i++) {
            // because of unavailable products, some gaps with empty objects will be available,
            // would be cheaper if postprocess them client/backend side
            if (idToProduct[i + 1].quantity > 0) {
                result[i] = idToProduct[i + 1];
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
