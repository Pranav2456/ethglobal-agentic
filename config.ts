// src/config/index.ts
export const CONFIG = {
  MORPHO: {
    address: "0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb",
    markets: {
      "ezETH-USDC": {
        id: "0xf2445fa4f7f5bbc31784e6c5c3f3bad857458ba8996c6aa0b4c7a17f9778edc3",
        collateralToken: "ezETH",
        loanToken: "USDC",
        lltv: 77,
        oracle: "0x1BAaC04fF917d1e386ffB4ACE4E6dE467D2828c2",
        irm: "0x46415998764C29aB2a25CbeA6254146D50D22687",
      },
      "cbETH-USDC": {
        id: "0xe73d018c199d26a4f1c470098e085907f8bbdb78666132f1c70391ee59627c26",
        collateralToken: "cbETH",
        loanToken: "USDC",
        lltv: 86,
        oracle: "0x83702c66cE01479C1Cca17B45B2dbDd22eeAdD80",
        irm: "0x46415998764C29aB2a25CbeA6254146D50D22687",
      },
      "AERO-USDC": {
        id: "0xe63d75ab709b86d37c01d9ae45f0674887c75631e13a8da05999bb25ad726320",
        collateralToken: "AERO",
        loanToken: "USDC",
        lltv: 77,
        oracle: "0x96F1C105D548befE2CD4884ca05120274FbC02a5",
        irm: "0x46415998764C29aB2a25CbeA6254146D50D22687",
      },
      "rETH-USDC": {
        id: "0xdb0b41414c7483989dd0db4e40df9f961cc93b535b91e3bdb10db8b4732f5d38",
        collateralToken: "rETH",
        loanToken: "USDC",
        lltv: 86,
        oracle: "0x7E1106B402e99Ef22a30E898cf1B79C41f52d7f3",
        irm: "0x46415998764C29aB2a25CbeA6254146D50D22687",
      },
      "wstETH-USDC": {
        id: "0xa0669396466af395acecdd18a261c89defda9eb7d6923cac0ea4177aeb93dcd5",
        collateralToken: "wstETH",
        loanToken: "USDC",
        lltv: 86,
        oracle: "0x957E0b2cd43aE03a6250a2bC8943a88413e9C4e2",
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
        id: "0xa4e24ca6effec79b7556c247279697039e7a85eab0ff7677685d5a8ddc00cba2",
        collateralToken: "weETH",
        loanToken: "USDC",
        lltv: 77,
        oracle: "0x9DBc71B21fC9114790E791C07120C9389A7f9bb4",
        irm: "0x46415998764C29aB2a25CbeA6254146D50D22687",
      },
    },
  },
  YIELD_MANAGER: {
    address: "YOUR_DEPLOYED_ADDRESS",
    minimumAPYDifference: 0.5, // 0.5% minimum difference to trigger strategy change
    checkInterval: 60 * 60 * 1000, // 1 hour in milliseconds
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
      address: "0x2E5B4a53C01626B6552f73F64F365649c26F78a7",
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
      address: "0x2416092f143378750F2d27178a5667802D3FE3Ef",
      decimals: 18,
    },
    weETH: {
      address: "0xCd5fE23C85820F7B72D0926FC9b05b43E359b7ee",
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


