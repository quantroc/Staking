// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "hardhat/console.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./RewardToken.sol";

contract Staking is Ownable{
    using SafeERC20 for IERC20;

    RewardToken public rewardToken; // Token trả thưởng

    uint256 public rewardTokensPerBlock; // Số lượng token thưởng được mint trên mỗi block
    uint256 private constant REWARDS_PRECISION = 1e12; // số để mul và div

    // staking user
    struct PoolStaker {
        uint256 amount; // số lượng token user stake
        uint256 rewards; // số lượng token user có thể rút
        uint256 rewardDebt; // The amount relative to accumulatedRewardsPerShare the user can't get as reward
    }

    // Staking pool
    struct Pool {
        IERC20 stakeToken; // token  stake
        uint256 tokensStaked; // tổng token đã stake
        uint256 lastRewardedBlock; // khối cuối cùng mà người dùng đã tính phần thưởng
        uint256 accumulatedRewardsPerShare; // phần thưởng tích lũy theo phần trăm share   
    }

    Pool[] public pools;

    // mapping poolId => staker address => PoolStaker
    mapping(uint256 => mapping(address => PoolStaker)) public poolStakers;

    event Deposit(address indexed user, uint256 indexed poolId, uint256 amount);
    event Withdraw(address indexed user, uint256 indexed poolId, uint256 amount);
    event HarvestRewards(address indexed user, uint256 indexed poolId, uint256 amount);
    event PoolCreated(uint256 poolId);

    constructor(address _rewardTokenAddress, uint256 _rewardTokensPerBlock) {
        rewardToken = RewardToken(_rewardTokenAddress);
        rewardTokensPerBlock = _rewardTokensPerBlock;
    }

    function poolLength() external view returns (uint) {
        return pools.length;
    }
    
    function createPool(IERC20 _stakeToken) external onlyOwner {
        Pool memory pool;
        pool.stakeToken =  _stakeToken;
        pools.push(pool);
        uint256 poolId = pools.length - 1;
        emit PoolCreated(poolId);
    }

    
    function deposit(uint256 _poolId, uint256 _amount) external {
        require(_amount > 0, "K gui bang 0");
        Pool storage pool = pools[_poolId];
        PoolStaker storage staker = poolStakers[_poolId][msg.sender];

        // update pool stakers
        harvestRewards(_poolId);

        // update staker
        staker.amount = staker.amount + _amount;
        staker.rewardDebt = staker.amount * pool.accumulatedRewardsPerShare / REWARDS_PRECISION;

        // update pool
        pool.tokensStaked = pool.tokensStaked + _amount;

        // deposit tokens
        emit Deposit(msg.sender, _poolId, _amount);
        pool.stakeToken.safeTransferFrom(
            address(msg.sender),
            address(this),
            _amount
        );
    }

    
    function withdraw(uint256 _poolId) external {
        Pool storage pool = pools[_poolId];
        PoolStaker storage staker = poolStakers[_poolId][msg.sender];
        uint256 amount = staker.amount;
        require(amount > 0, "Withdraw amount can't be zero");

        // pay rewards
        harvestRewards(_poolId);

        // update staker
        staker.amount = 0;
        staker.rewardDebt = staker.amount * pool.accumulatedRewardsPerShare / REWARDS_PRECISION;

        // update pool
        pool.tokensStaked = pool.tokensStaked - amount;

        // withdraw tokens
        emit Withdraw(msg.sender, _poolId, amount);
        pool.stakeToken.safeTransfer(
            address(msg.sender),
            amount
        );
    }

    
    function harvestRewards(uint256 _poolId) public {
        updatePoolRewards(_poolId);
        Pool storage pool = pools[_poolId];
        PoolStaker storage staker = poolStakers[_poolId][msg.sender];
        uint256 rewardsToHarvest = (staker.amount * pool.accumulatedRewardsPerShare / REWARDS_PRECISION) - staker.rewardDebt;
        if (rewardsToHarvest == 0) {
            staker.rewardDebt = staker.amount * pool.accumulatedRewardsPerShare / REWARDS_PRECISION;
            return;
        }
        staker.rewards = 0;
        staker.rewardDebt = staker.amount * pool.accumulatedRewardsPerShare / REWARDS_PRECISION;
        emit HarvestRewards(msg.sender, _poolId, rewardsToHarvest);
        rewardToken.mint(msg.sender, rewardsToHarvest);
    }

    
    function updatePoolRewards(uint256 _poolId) private {
        Pool storage pool = pools[_poolId];
        if (pool.tokensStaked == 0) {
            pool.lastRewardedBlock = block.number;
            return;
        }
        uint256 blocksSinceLastReward = block.number - pool.lastRewardedBlock;
        uint256 rewards = blocksSinceLastReward * rewardTokensPerBlock;
        pool.accumulatedRewardsPerShare = pool.accumulatedRewardsPerShare + (rewards * REWARDS_PRECISION / pool.tokensStaked);
        pool.lastRewardedBlock = block.number;
    }
}