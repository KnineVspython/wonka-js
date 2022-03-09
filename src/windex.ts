import { request, gql } from 'graphql-request';
import { PublicKey } from '@solana/web3.js';
import log from 'loglevel';

export enum WINDEX_ENDPOINT {
  // Solana Devnet (https://explorer.solana.com/?cluster=devnet)
  // To explore queries: https://api.wonkalabs.xyz/v0.1/solana/graphiql?cluster=devnet
  DEVNET = "https://api.wonkalabs.xyz/v0.1/solana/devnet/graphql",

  // Solana Mainnet Beta (https://explorer.solana.com/)
  // To explore queries: https://api.wonkalabs.xyz/v0.1/solana/graphiql?cluster=mainnet
  MAINNET = "https://api.wonkalabs.xyz/v0.1/solana/mainnet/graphql",
}

export interface CandyMachineState {
  id: string;
  items_redeemed: number;
  items_available: number;
  price: number;
  go_live_date: number;
}

export interface CollectionItem {
  address: string;
  name: string;
  symbol: string | null;
  description: string | null | undefined;
  external_url: string | null | undefined;
  image_url: string;
  explorer_url: string;
  creators: {
    address: string;
    verified: boolean;
    share: number;
  }[],
  files: {
    uri: string | null;
    type: string | null;
  }[],
  attributes: {
    trait_type: string | null;
    value: string | null;
  }[],
}

type nft = {
  id: string;
  name: string;
  symbol: string | null;
  explorer_url: string;
  image: {
    orig: string;
  };
  metaplex_metadata: {
    mint: string;
    creators: {
      address: string;
      verified: boolean;
      share: number;
    }[],
  };
  external_metadata: {
    description: string | null;
    external_url: string | null;
    properties: {
      files: {
        uri: string | null;
        type: string | null;
      }[] | null;
    } | null;
    attributes: {
      trait_type: string | null;
      value: string | null;
    }[] | null;
  } | null;
};

function nftToCollectionItem(nft: nft): CollectionItem {
  return {
    address: nft.metaplex_metadata.mint,
    name: nft.name,
    symbol: nft.symbol,
    description: nft.external_metadata?.description,
    external_url: nft.external_metadata?.external_url,
    image_url: nft.image.orig,
    explorer_url: nft.explorer_url,
    creators: nft.metaplex_metadata.creators,
    files: nft.external_metadata?.properties?.files || [],
    attributes: nft.external_metadata?.attributes || [],
  };
}

function nftsToCollectionItems(nfts: nft[]): CollectionItem[] {
  return nfts.map((nft): CollectionItem => {
    return nftToCollectionItem(nft);
  });
}

/**
 * Wonka Indexer is the fastest indexer in the wild west.
 * Currently, we have four data sets you can fetch through windex:
 * - Candy Machine State
 * - NFTs by Candy Machine
 * - NFTs by Wallet Address
 * - NFT by Mint Address
 */
export default class Windex {
  public static async fetchCandyMachineState(
    candyMachineId: PublicKey,
    endpoint: WINDEX_ENDPOINT = WINDEX_ENDPOINT.DEVNET,
  ): Promise<CandyMachineState> {
    log.info(`Fetching candy machine state for candy machine with ID: ${candyMachineId.toString()}`);
    const fetchCandyMachineStateQuery = gql`
    {
      candyMachineV2(id: "${candyMachineId.toString()}") {
        id
        items_redeemed
        items_available
        price
        go_live_date
      }
    }`;
    const results = await request(endpoint, fetchCandyMachineStateQuery);
    return results.candyMachineV2 as CandyMachineState;
  }

  public static async fetchNFTsByCandyMachine(
    candyMachineId: PublicKey,
    first: number = 20,
    endpoint: WINDEX_ENDPOINT = WINDEX_ENDPOINT.DEVNET,
  ): Promise<CollectionItem[]> {
    log.info(`Fetching NFTs by candy machine with ID: ${candyMachineId.toString()}`);
    const fetchNFTsByCandyMachineQuery = gql`
    {
      nftsByCollection(collectionId:"${candyMachineId.toString()}", first:${first}) {
        edges {
          node {
            id
            name
            symbol
            explorer_url
            image {
              orig
            }
            metaplex_metadata {
              mint
              creators {
                address
                verified
                share
              }
            }
            external_metadata {
              description
              external_url
              properties {
                files {
                  uri
                  type
                }
              }
              attributes {
                trait_type
                value
              }
            }
          }
        }
      }
    }`;
    const results = await request(endpoint, fetchNFTsByCandyMachineQuery);
    const nfts = results.nftsByCollection.edges.map((edge) => edge.node) as nft[];
    return nftsToCollectionItems(nfts);
  }

  public static async fetchNFTsByWallet(
    walletAddress: PublicKey,
    first: number = 20,
    endpoint: WINDEX_ENDPOINT = WINDEX_ENDPOINT.DEVNET,
  ): Promise<CollectionItem[]> {
    log.info(`Fetching NFTs by wallet with ID: ${walletAddress.toString()}`);
    const fetchNFTsByCandyMachineQuery = gql`
    {
      nftsByWallet(wallet: "${walletAddress.toString()}", first: ${first}) {
        edges {
          node {
            id
            name
            symbol
            explorer_url
            image {
              orig
            }
            metaplex_metadata {
              mint
              creators {
                address
                verified
                share
              }
            }
            external_metadata {
              description
              external_url
              properties {
                files {
                  uri
                  type
                }
              }
              attributes {
                trait_type
                value
              }
            }
          }
        }
      }
    }`;
    const results = await request(endpoint, fetchNFTsByCandyMachineQuery);
    const nfts = results.nftsByWallet.edges.map((edge) => edge.node) as nft[];
    return nftsToCollectionItems(nfts);
  }

  public static async fetchNFTByMintAddress(
    mintAddress: PublicKey,
    endpoint: WINDEX_ENDPOINT = WINDEX_ENDPOINT.DEVNET,
  ): Promise<CollectionItem | null> {
    log.info(`Fetching NFTs by mint address with ID: ${mintAddress.toString()}`);
    const fetchNFTsByCandyMachineQuery = gql`
    {
      nftByMintID(mintID: "${mintAddress.toString()}") {
        id
        name
        symbol
        explorer_url
        image {
          orig
        }
        metaplex_metadata {
          mint
          creators {
            address
            verified
            share
          }
        }
        external_metadata {
          description
          external_url
          properties {
            files {
              uri
              type
            }
          }
          attributes {
            trait_type
            value
          }
        }
      }
    }`;
    const results = await request(endpoint, fetchNFTsByCandyMachineQuery);
    return nftToCollectionItem(results.nftByMintID);
  }
}

export { Windex };