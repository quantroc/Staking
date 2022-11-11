// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

import "hardhat/console.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./RewardToken.sol";

contract Staking is Ownable {
    using SafeERC20 for IERC20;

    RewardToken public rewardToken; //token trả thưởng

    uint256 private rewardTokensPerBlock; //thưởng mỗi block
    uint256 private constant REWARDS_PERCISION = 1e12;

    struct Staker {
        uint256 amount; // số lượng token mà user stake
        uint256 rewards; // số lượng token phần thưởng mà user có thể rút
        uint256 rewardDebt; // số lượng token phần thưởng đã trừ đi phần thu hoạch
    }

    struct Pool {
        IERC20 stakeToken; //
        uint256 totalTokenStaked; // tổng lượng token trong pool
        uint256 lastRewardedBlock; //block cuối
        uint256 accumulatedRewardsPerShare; // tổng reward per share
    }

    Pool[] public pools; //staking pools
    //poolId => staker address => Staler
    mapping(uint256 => mapping(address => Staker)) public Stakers;

    //event
    event CreatePool(uint256 poolId);
    event Deposit(address indexed user, uint256 indexed poolId, uint256 amount);
    event WithDraw(
        address indexed user,
        uint256 indexed poolId,
        uint256 amount
    );
    event HarvestReward(
        address indexed user,
        uint256 indexed poolId,
        uint256 amount
    );

    constructor(address _rewardTokenAddress, uint256 _rewardTokenPerBlock) {
        rewardToken = RewardToken(_rewardTokenAddress);
        rewardTokensPerBlock = _rewardTokenPerBlock;
    }

    function createPool(IERC20 _stakeToken) external onlyOwner {
        Pool memory pool;
        pool.stakeToken = _stakeToken;
        pools.push(pool);
        uint256 poolId = pools.length - 1;
        emit CreatePool(poolId);
    }

    function deposit(uint256 _poolId, uint256 _amount) public {
        require(_amount > 0, "can't deposit 0");

        Pool storage pool = pools[_poolId];
        Staker storage staker = Stakers[_poolId][msg.sender];
        //update all staker
        harvestReward(_poolId);

        //update staker
        staker.amount = staker.amount + _amount;
        staker.rewardDebt =
            (staker.amount * pool.accumulatedRewardsPerShare) /
            REWARDS_PERCISION;

        //update pool
        pool.totalTokenStaked = pool.totalTokenStaked + _amount;

        emit Deposit(msg.sender, _poolId, _amount);

        //deposit
        pool.stakeToken.safeTransferFrom(msg.sender, address(this), _amount);
    }

    function withdraw(uint256 _poolId) external {
        Pool storage pool = pools[_poolId];
        Staker storage staker = Stakers[_poolId][msg.sender];

        uint256 amount = staker.amount;
        require(amount > 0, "cant with draw 0");

        //Pay reward
        harvestReward(_poolId);

        //update staker
        staker.amount = 0;
        staker.rewardDebt =
            (staker.amount * pool.accumulatedRewardsPerShare) /
            REWARDS_PERCISION;

        //update pool
        pool.totalTokenStaked = pool.totalTokenStaked - amount;

        emit WithDraw(msg.sender, _poolId, amount);

        //with draw
        pool.stakeToken.safeTransfer(msg.sender, amount);
    }

    function harvestReward(uint256 _poolId) public {
        updatePoolReward(_poolId);
        Pool storage pool = pools[_poolId];
        Staker storage staker = Stakers[_poolId][msg.sender];
        uint256 rewardToHarvest = ((staker.amount *
            pool.accumulatedRewardsPerShare) / REWARDS_PERCISION) -
            staker.rewardDebt;
        if (rewardToHarvest == 0) {
            staker.rewardDebt =
                (staker.amount * pool.accumulatedRewardsPerShare) /
                REWARDS_PERCISION;
            return;
        }
        staker.rewards = 0;
        staker.rewardDebt =
            (staker.amount * pool.accumulatedRewardsPerShare) /
            REWARDS_PERCISION;
        emit HarvestReward(msg.sender, _poolId, rewardToHarvest);
        rewardToken.mint(msg.sender, staker.rewardDebt);
    }

    function updatePoolReward(uint256 _poolId) private {
        Pool storage pool = pools[_poolId];

        if (pool.totalTokenStaked == 0) {
            pool.lastRewardedBlock = block.number;
            return;
        }
        uint256 blocksSinceLastReward = block.number - pool.lastRewardedBlock;
        uint256 rewards = blocksSinceLastReward * rewardTokensPerBlock;
        pool.accumulatedRewardsPerShare =
            pool.accumulatedRewardsPerShare +
            ((rewards * pool.totalTokenStaked) / REWARDS_PERCISION);
        pool.lastRewardedBlock = block.number;
    }
}
