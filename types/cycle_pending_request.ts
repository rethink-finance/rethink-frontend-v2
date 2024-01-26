export default interface ICyclePendingRequest {
  id: string;
  token: string;
  available_tokens: number;
  pending_tokens: number;
}
