//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";

contract TechnoLimeShop is Ownable {
    event ProductAdded(Product _product);
    event QuantityUpdated(uint256 _id, uint256 _updatedQuantity);
    event ProductBought(address indexed _buyer, uint256 _id, uint256 _quantity);

    struct Product {
        string name;
        uint256 quantity;
        uint256 priceWei;
        bool exists;
    }

    uint256 public index = 0;

    mapping(uint256 => Product) idToProduct;

    // if the name does NOT exist, 0 is returned
    mapping(string => uint256) nameToProductId;

    // client => (productId => quantity)
    mapping(address => mapping(uint256 => uint256)) clientToPurchasedProducts;
    mapping(uint256 => address[]) productIdToClients;

    // if this function is marked as external,
    // the product argument can be calldata (cheaper)
    function addProduct(Product memory newProduct) public onlyOwner {
        require(newProduct.quantity > 0, "Quantity should be greater than 0");
        uint256 productId = nameToProductId[newProduct.name];
        if (productId > 0) {
            // product exists, update quantity only
            Product storage product = idToProduct[productId];
            product.quantity += newProduct.quantity;

            emit QuantityUpdated(productId, product.quantity);
        } else {
            // product does not exist, add it
            Product memory product = Product(
                newProduct.name,
                newProduct.quantity,
                5 * 10e18,
                true
            );

            nameToProductId[product.name] = index;
            idToProduct[index] = product;
            index++;
            emit ProductAdded(product);
        }
    }

    function buyProduct(uint256 id, uint256 quantity) public {
        require(
            clientToPurchasedProducts[msg.sender][id] == 0,
            "Already bought"
        );
        Product storage desiredProduct = idToProduct[id];
        require(desiredProduct.exists, "Product with such ID does not exist !");
        require(
            desiredProduct.quantity >= quantity,
            "There is no quantity avialable !"
        );

        desiredProduct.quantity -= quantity;
        clientToPurchasedProducts[msg.sender][id] += quantity;
        productIdToClients[id].push(msg.sender);

        // update balance

        // emit event
        emit ProductBought(msg.sender, id, quantity);
    }

    function getProducts() public view returns (Product[] memory) {
        Product[] memory result = new Product[](index);
        for (uint256 i = 0; i < index; i++) {
            result[i] = idToProduct[i];
        }
        return result;
    }

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

/**

Ако може пояснение, за комбинацията от двете условия, 'times' го разбирам малко противоречиво.
- A client cannot buy the same product more than one time.
    -- Какво означава това изрично условие ?
    -- 'one time' го разбирам, покупката да бъде в рамките на 1 транзакция и без значение колко бройки, стига да има налични ? Защото долу се споменава, че е възможно купуването на повече бройки, ако има наличност (върнати или заредени).
- The clients should not be able to buy a product more times than the quantity in the store unless a product is returned or added by the administrator (owner)


В случай, че може да се купуват повече бройки: 
Buyers should be able to return products if they are not satisfied (within a certain period in blocktime: 100 blocks).
    - за връщане на продукт с quantity > 1, частично или пълно връщане на бройките ?

 */
