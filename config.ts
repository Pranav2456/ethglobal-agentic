// src/config/index.ts
export const CONFIG = {
  MORPHO: {
    address: "0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb",
    markets: {
      "ezETH-USDC": {
        id: "0xf24417ee06adc0b0836cf0dbec3ba56c1059f62f53a55990a38356d42fa75fa2",
        collateralToken: "ezETH",
        loanToken: "USDC",
        lltv: 77,
        oracle: "0x1BAaB21821c6468f8aee73ee60Fd8Fdc39c0C973",
        irm: "0x46415998764C29aB2a25CbeA6254146D50D22687",
      },
      "cbETH-USDC": {
        id: "0xe73d71cacb1a11ce1033966787e21b85573b8b8a3936bbd7d83b2546a1077c26",
        collateralToken: "cbETH",
        loanToken: "USDC",
        lltv: 86,
        oracle: "0x8370D60541403B5Cd42966D6a7d6d1239bd50ed1",
        irm: "0x46415998764C29aB2a25CbeA6254146D50D22687",
      },
      "AERO-USDC": {
        id: "0xe63d3f30d872e49e86cf06b2ffab5aa016f26095e560cb8d6486f9a5f774631e",
        collateralToken: "AERO",
        loanToken: "USDC",
        lltv: 77,
        oracle: "0x96F1485DAf396c2ab7e53DC76d7B330143Cb2269",
        irm: "0x46415998764C29aB2a25CbeA6254146D50D22687",
      },
      "rETH-USDC": {
        id: "0xdb0bc9f10a174f29a345c5f30a719933f71ccea7a2a75a632a281929bba1b535",
        collateralToken: "rETH",
        loanToken: "USDC",
        lltv: 86,
        oracle: "0x7E1136C04372874cca9C3C9a2DbC461E3858b228",
        irm: "0x46415998764C29aB2a25CbeA6254146D50D22687",
      },
      "wstETH-USDC": {
        id: "0xa066f3893b780833699043f824e5bb88b8df039886f524f62b9a1ac83cb7f1f0",
        collateralToken: "wstETH",
        loanToken: "USDC",
        lltv: 86,
        oracle: "0x957e76d8f2D3ab0B4f342cd5f4b03A6f6eF2ce5F",
        irm: "0x46415998764C29aB2a25CbeA6254146D50D22687",
      },
      "WETH-USDC": {
        id: "0x8793cf302b8ffd655ab97bd1c695dbd967807e8367a65cb2f4edaf1380ba1bda",
        collateralToken: "WETH",
        loanToken: "USDC",
        lltv: 86,
        oracle: "0xFEa2D58cEfCb9fcb597723c6bAE66fFE4193aFE4",
        irm: "0x46415998764C29aB2a25CbeA6254146D50D22687",
      },
      "weETH-USDC": {
        id: "0x6a331b22b56c9c0ee32a1a7d6f852d2c682ea8b27a1b0f99a9c484a37a951eb7",
        collateralToken: "weETH",
        loanToken: "USDC",
        lltv: 77,
        oracle: "0xaacbD2BbCA7927F772145f99EC942024Ddd0FAB0",
        irm: "0x46415998764C29aB2a25CbeA6254146D50D22687",
      },
    },
  },
  YIELD_MANAGER: {
    address: "0x90Cae48cEC3595Cd1A6a9D806679EEE50F364979",
    minimumAPYDifference: 0.5, // 0.5% minimum difference to trigger strategy change
    checkInterval: 60 * 60 * 1000, // 1 hour in milliseconds
  },
  STRATEGIES: {
    MORPHO: {
        address: "0x9bBF97fE8CF3faE8d58915878c9C1eb1892C46F2" as `0x${string}`,
        protocol: "morpho" as const
    },
    AAVE: {
        address: "0x9C80FE3Abc89d865Fe307707047D3d57414cD395" as `0x${string}`,
        protocol: "aave" as const
    }
},
  TOKENS: {
    USDC: {
      address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      decimals: 6,
    },
    WETH: {
      address: "0x4200000000000000000000000000000000000006",
      decimals: 18,
    },
    wstETH: {
      address: "0xc1CBa3fCea344f92D9239c08C0568f6F2F0ee452",
      decimals: 18,
    },
    cbETH: {
      address: "0x2Ae3F1Ec7F1F5012CFEab0185bfc7aa3cf0DEc22",
      decimals: 18,
    },
    rETH: {
      address: "0xB6fe221Fe9EeF5aBa221c348bA20A1Bf5e73624c",
      decimals: 18,
    },
    ezETH: {
      address: "0x2416092f143378750bb29b79eD961ab195CcEea5",
      decimals: 18,
    },
    weETH: {
      address: "0x04C0599Ae5A44757c0af6F9eC3b93da8976c150A",
      decimals: 18,
    },
    AERO: {
      address: "0x940181a94A35A4569E4529A3CDfB74e38FD98631",
      decimals: 18,
    },
  },
  NETWORK: {
    id: "base-mainnet",
    rpcUrl: process.env.BASE_MAINNET_RPC_URL,
  },
  TRANSACTIONS: {
    MAX_GAS_COST_PERCENTAGE: 5,
    GAS_LIMIT: 500000,
    MAX_SLIPPAGE: 0.5 // 0.5%
},
};

export const MARKET_RISK_LEVELS = {
  HIGH_LLTV: 90, // LLTV > 90%
  MEDIUM_LLTV: 80, // LLTV > 80%
  // Markets below 80% LLTV are considered LOW risk

  HIGH_UTILIZATION: 80, // > 80% utilization
  MEDIUM_UTILIZATION: 50, // > 50% utilization
  // Markets below 50% utilization are considered LOW risk
};


