export interface IExcludeNAVDetailsHashes {
  [chainId: string]: string[];
}

export const excludeNAVDetailsHashes = {
  "0x89": [
    "0xd87d9b63abe927264903466398cabf9e105ac2fae7c6dc76f822d8ef89e7012d",
    "0xe63fd752a9fdc61a6bb0ac72d9134f09f1f85778192fa6d10278bd9a09a425e9",
    "0x36e7ba53628d044345c9d4e0e9b917f5479d1d4a3e212a0e5b56493f67958020",
    "0x6798edd8ad8861e9e653967ad7938d3646b3058d1a5b6dc98352d99648f45e43",
    "0xeaf175c9485c6b69e0d2005b58a57da04d12c8b0f27bae21547abebdf527c374",
    "0x94f12e7002169840f86b41a8dd9b238449dcf449c2f9be33e3d3717c4bdb3b84",
    "0x37c0cad1bac6a4cdd3a7e5f13162b8b1c7fd8db96ce2557de5db67e1f8213ece",
    "0x003651b0da2306f94cde72d015b08ba7d647d94cddd832a0ece2814a433abf5f",
    "0xb749dd887a361f0a54620e6b951cdbe81b247fd13579b1adccbebb3f20d2fdc5",
  ],
  "0xa4b1": [],
  "0xfc": [],
  "0x1": [],
  // Base
  "0x2105": [
    "0x4226e636db1dbaa1da860ce7df92d151aaea7f23934b94a21bc75d2c1d6233ee",
    "0x50a4f3bc878614729c8dc9365a4ad9ea717e089870d706459c85e1f8fb89ac94",
  ],
} as IExcludeNAVDetailsHashes;
