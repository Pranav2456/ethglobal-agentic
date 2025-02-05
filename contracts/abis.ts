export const YIELD_MANAGER_ABI = [
        {
          type: "constructor",
          inputs: [
            {
              name: "_owner",
              type: "address",
              internalType: "address"
            }
          ],
          stateMutability: "nonpayable"
        },
        {
          type: "function",
          name: "deposit",
          inputs: [
            {
              name: "_strategy",
              type: "address",
              internalType: "address"
            },
            {
              name: "_tokens",
              type: "address[]",
              internalType: "address[]"
            },
            {
              name: "_amounts",
              type: "uint256[]",
              internalType: "uint256[]"
            },
            {
              name: "_additionalData",
              type: "bytes",
              internalType: "bytes"
            },
            {
              name: "_for",
              type: "address",
              internalType: "address"
            }
          ],
          outputs: [],
          stateMutability: "nonpayable"
        },
        {
          type: "function",
          name: "getAllStrategies",
          inputs: [],
          outputs: [
            {
              name: "",
              type: "address[]",
              internalType: "address[]"
            }
          ],
          stateMutability: "view"
        },
        {
          type: "function",
          name: "getStrategy",
          inputs: [
            {
              name: "_index",
              type: "uint256",
              internalType: "uint256"
            }
          ],
          outputs: [
            {
              name: "",
              type: "address",
              internalType: "address"
            }
          ],
          stateMutability: "view"
        },
        {
          type: "function",
          name: "owner",
          inputs: [],
          outputs: [
            {
              name: "",
              type: "address",
              internalType: "address"
            }
          ],
          stateMutability: "view"
        },
        {
          type: "function",
          name: "removeStrategy",
          inputs: [
            {
              name: "_strategy",
              type: "address",
              internalType: "address"
            }
          ],
          outputs: [],
          stateMutability: "nonpayable"
        },
        {
          type: "function",
          name: "renounceOwnership",
          inputs: [],
          outputs: [],
          stateMutability: "nonpayable"
        },
        {
          type: "function",
          name: "transferOwnership",
          inputs: [
            {
              name: "newOwner",
              type: "address",
              internalType: "address"
            }
          ],
          outputs: [],
          stateMutability: "nonpayable"
        },
        {
          type: "function",
          name: "whitelistStrategy",
          inputs: [
            {
              name: "_strategy",
              type: "address",
              internalType: "address"
            }
          ],
          outputs: [],
          stateMutability: "nonpayable"
        },
        {
          type: "function",
          name: "withdraw",
          inputs: [
            {
              name: "_strategy",
              type: "address",
              internalType: "address"
            },
            {
              name: "_tokens",
              type: "address[]",
              internalType: "address[]"
            },
            {
              name: "_amounts",
              type: "uint256[]",
              internalType: "uint256[]"
            },
            {
              name: "_additionalData",
              type: "bytes",
              internalType: "bytes"
            },
            {
              name: "_to",
              type: "address",
              internalType: "address"
            }
          ],
          outputs: [],
          stateMutability: "nonpayable"
        },
        {
          type: "event",
          name: "DepositedIntoStrategy",
          inputs: [
            {
              name: "by",
              type: "address",
              indexed: false,
              internalType: "address"
            },
            {
              name: "strategy",
              type: "address",
              indexed: true,
              internalType: "address"
            },
            {
              name: "tokens",
              type: "address[]",
              indexed: true,
              internalType: "address[]"
            },
            {
              name: "amounts",
              type: "uint256[]",
              indexed: false,
              internalType: "uint256[]"
            },
            {
              name: "additionalData",
              type: "bytes",
              indexed: false,
              internalType: "bytes"
            },
            {
              name: "onBehalfOf",
              type: "address",
              indexed: true,
              internalType: "address"
            }
          ],
          anonymous: false
        },
        {
          type: "event",
          name: "OwnershipTransferred",
          inputs: [
            {
              name: "previousOwner",
              type: "address",
              indexed: true,
              internalType: "address"
            },
            {
              name: "newOwner",
              type: "address",
              indexed: true,
              internalType: "address"
            }
          ],
          anonymous: false
        },
        {
          type: "event",
          name: "RemovedStrategyFromWhitelist",
          inputs: [
            {
              name: "strategy",
              type: "address",
              indexed: true,
              internalType: "address"
            }
          ],
          anonymous: false
        },
        {
          type: "event",
          name: "WhitelistedStrategy",
          inputs: [
            {
              name: "strategy",
              type: "address",
              indexed: true,
              internalType: "address"
            }
          ],
          anonymous: false
        },
        {
          type: "event",
          name: "WithdrawnFromStrategy",
          inputs: [
            {
              name: "by",
              type: "address",
              indexed: true,
              internalType: "address"
            },
            {
              name: "strategy",
              type: "address",
              indexed: true,
              internalType: "address"
            },
            {
              name: "tokens",
              type: "address[]",
              indexed: true,
              internalType: "address[]"
            },
            {
              name: "amounts",
              type: "uint256[]",
              indexed: false,
              internalType: "uint256[]"
            },
            {
              name: "additionalData",
              type: "bytes",
              indexed: false,
              internalType: "bytes"
            },
            {
              name: "to",
              type: "address",
              indexed: false,
              internalType: "address"
            }
          ],
          anonymous: false
        },
        {
          type: "error",
          name: "OwnableInvalidOwner",
          inputs: [
            {
              name: "owner",
              type: "address",
              internalType: "address"
            }
          ]
        },
        {
          type: "error",
          name: "OwnableUnauthorizedAccount",
          inputs: [
            {
              name: "account",
              type: "address",
              internalType: "address"
            }
          ]
        },
        {
          type: "error",
          name: "SafeERC20FailedOperation",
          inputs: [
            {
              name: "token",
              type: "address",
              internalType: "address"
            }
          ]
        },
        {
          type: "error",
          name: "Utils__AddressZero",
          inputs: []
        },
        {
          type: "error",
          name: "Utils__LengthsDoNotMatch",
          inputs: [
            {
              name: "length1",
              type: "uint256",
              internalType: "uint256"
            },
            {
              name: "length2",
              type: "uint256",
              internalType: "uint256"
            }
          ]
        },
        {
          type: "error",
          name: "Utils__ValueZero",
          inputs: []
        },
        {
          type: "error",
          name: "YieldStrategyManager__FailedToDepositIntoStrategy",
          inputs: []
        },
        {
          type: "error",
          name: "YieldStrategyManager__FailedToWithdrawFromStrategy",
          inputs: []
        },
        {
          type: "error",
          name: "YieldStrategyManager__NotWhitelistedStrategy",
          inputs: [
            {
              name: "strategy",
              type: "address",
              internalType: "address"
            }
          ]
        }
      ];
export const ERC20_ABI = [/* Standard ERC20 ABI */];