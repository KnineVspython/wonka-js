import { Connection, PublicKey, TransactionError } from '@solana/web3.js';
import { Metadata, MetadataProgram, MetadataDataData } from '@metaplex-foundation/mpl-token-metadata';
import { Wallet, actions} from '@metaplex/js';
import ArweaveUploader from '../arweave-uploader';
import {getCandyMachineCreator} from '../utils/pda-utils'
import log from 'loglevel';

const MAX_NAME_LENGTH = 32;
const MAX_URI_LENGTH = 200;
const MAX_SYMBOL_LENGTH = 10;
const MAX_CREATOR_LEN = 32 + 1 + 1;

const getCandyMachineMints = async (candyMachineId: string, connection: Connection): Promise<Metadata[]> => {
  const candyMachineCreatorId = (await getCandyMachineCreator(new PublicKey(candyMachineId)))[0].toString()
  const metadataAccounts = await MetadataProgram.getProgramAccounts(connection, {
    filters: [
      {
        memcmp: {
          offset:
            1 +
            32 +
            32 +
            4 +
            MAX_NAME_LENGTH +
            4 +
            MAX_URI_LENGTH +
            4 +
            MAX_SYMBOL_LENGTH +
            2 +
            1 +
            4 +
            0 * MAX_CREATOR_LEN,
          bytes: candyMachineCreatorId,
        },
      },
    ],
  });
  return await Promise.all(
    metadataAccounts.map(async (account) => {
      const accountInfo = await connection.getAccountInfo(account.pubkey);
      const metadata = new Metadata(account.pubkey, accountInfo!);
      return metadata;
    }),
  );
};

const getMintMetadata = async (connection: Connection, mintAddress: PublicKey): Promise<Metadata> => {
  const metadataPDA = await Metadata.getPDA(mintAddress);
  log.info(`Loading metadata PDA ${metadataPDA.toString()} for token address: ${mintAddress.toString()}.`)
  return await Metadata.load(connection, metadataPDA);
}

const getMintMetadataDataData = async (connection: Connection, mintAddress: PublicKey): Promise<MetadataDataData> => {
  const metadata = await getMintMetadata(connection, mintAddress)
  return metadata.data.data as MetadataDataData
}

const updateMintURI = async (
  connection: Connection, 
  arweaveUploader: ArweaveUploader,
  wallet: Wallet, 
  mintKey: PublicKey, 
  mintURI: string,
  imageContext: any): Promise <{txid: string, error?: TransactionError}> => {
  const metadataDataData = await getMintMetadataDataData(connection, mintKey)
  const metadataDataDataURI = await fetch(metadataDataData.uri)
  const metadataDataDataURIJSON = await metadataDataDataURI.json()
  metadataDataDataURIJSON.image = mintURI
  metadataDataDataURIJSON.properties.files[0].uri = mintURI
  metadataDataDataURIJSON.imageContext = imageContext
  const metadataDataDataJSONArweaveURI = await arweaveUploader.uploadJSON(metadataDataDataURIJSON)
  metadataDataData.uri = metadataDataDataJSONArweaveURI
  const txid = await actions.updateMetadata({
    connection, 
    editionMint: new PublicKey(mintKey),
    wallet,
    newMetadataData: metadataDataData,
  })
  log.info(`Starting update metadata transaction with id:${txid}.`)
  return new Promise((resolve, reject) => {
    connection.onSignatureWithOptions(
      txid,
      async (notification, _) => {
        log.info(`Got notification of type: ${notification.type} from txid: ${txid}.`);
        if (notification.type === 'status') {
          const { result } = notification;
          if (result.err) {
            reject({ txid, error: result.err });
          } else {
            resolve({ txid });
          }
        }
      },
      { commitment: 'processed' },
    );
  });
}

const updateMintImage = async (
  b64image: string,
  connection: Connection, 
  arweaveUploader: ArweaveUploader,
  wallet: Wallet, 
  mintAddress: PublicKey,
  imageContext: any) => { 
    const uri = await arweaveUploader.uploadBase64PNG(b64image)
    log.info(`Uploaded base64 image to arweave, here is the url: ${uri}`)
    return await updateMintURI(connection, arweaveUploader, wallet, mintAddress, uri, imageContext)
}

export { 
  getCandyMachineMints,
  getMintMetadata,
  updateMintURI,
  updateMintImage
 };
