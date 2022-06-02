//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/ownership/Ownable.sol";

contract TechnoLimeShop is Ownable {
    event ProductAdded(Product _product);
    event QuantityUpdated(uint256 _id, uint256 _updatedQuantity);

    struct Product {
        string name;
        uint256 quantity;
        // will be used to see if the Products are initialized inside the mappings
        bool exists;
    }

    // start ids from 1. As a defaul value 0 is reserved for non-existent products
    uint256 public index = 1;

    // if the name does NOT exist, 0 is returned
    mapping(string => uint256) nameToProductId;

    mapping(uint256 => Product) idToProduct;

    // if this function is marked as external,
    // the product argument can be calldata (cheaper)
    function addProduct(Product memory newProduct) public onlyOwner {
        require(newProduct.quantity > 0, "Quantity should be greater than 0");
        uint256 productId = nameToProductId[newProduct.name];
        if (productId > 0) {
            // product exists, update quantity only
            Product storage product = idToProduct[productId];
            product.quantity += newProduct.quantity;

            emit QuantityUpdated(product.id, product.quantity);
        } else {
            // product does not exist, add it
            Product storage product = new Product(
                newProduct.name,
                newProduct.quantity,
                true
            );
            nameToProductId[product.name] = index;
            idToProduct[index] = product;
            index++;
            emit ProductAdded(product);
        }
    }

    function buyProduct(uint256 id, uint256 quantity) public {
        Product memory desiredProduct = idToProduct[id];
        require(desiredProduct.exists, "Product with such ID does not exist !");
        require(
            desiredProduct.quantity > 0,
            "There is no quantity avialable !"
        );
    }

    function getProducts() public view returns (Product[] memory) {
        return products;
    }
}

/**

The administrator should not be able to add the same product twice, just quantity. 
    - how do u define a Product, by it's id or name ? i.e. How the product will be passed

The clients should not be able to buy a product more times than the quantity
    - should I use ETH transactions + payable functions, or assume the price is 0.


 */
