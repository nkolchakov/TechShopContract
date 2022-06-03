module.exports = async ({ getUnnamedAccounts, deployments }) => {
    const { deploy } = deployments;
    const users = await getUnnamedAccounts();
    await deploy('TechnoLimeShop', {
        from: users[0],
        args: [],
        log: true,
    });
};
module.exports.tags = ['TechnoLimeShop'];