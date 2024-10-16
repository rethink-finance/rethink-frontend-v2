

export default interface IFundMetaData {
    startTime: bigint;                   
    totalNav: bigint;                  
    totalDepositBal: bigint;            
    cumulativeReturn: bigint;            
    illiquidLen: bigint;                
    liquidLen: bigint;                   
    nftLen: bigint;                      
    composableLen: bigint;             
    fundBaseTokenDecimals: bigint;      
    fundMetadata: string;               
    fundName: string;                    
    fundBaseTokenSymbol: string;         
}
