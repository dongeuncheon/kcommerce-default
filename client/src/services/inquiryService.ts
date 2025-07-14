import { api } from './api';
import { 
  CreateInquiryDto, 
  UpdateInquiryDto, 
  CreateReplyDto,
  InquirySearchParams,
  InquiryStats
} from '../types/inquiry';

class InquiryService {
  async createInquiry(data: CreateInquiryDto) {
    const response = await api.post('/inquiries', data);
    return response.data.data;
  }

  async getInquiries(params?: InquirySearchParams) {
    const response = await api.get('/inquiries', { params });
    return response.data;
  }

  async getInquiry(id: string, password?: string) {
    const params = password ? { password } : {};
    const response = await api.get(`/inquiries/${id}`, { params });
    return response.data.data;
  }

  async updateInquiry(id: string, data: UpdateInquiryDto) {
    const response = await api.put(`/inquiries/${id}`, data);
    return response.data.data;
  }

  async createReply(inquiryId: string, data: CreateReplyDto) {
    const response = await api.post(`/inquiries/${inquiryId}/replies`, data);
    return response.data.data;
  }

  async getStats(): Promise<InquiryStats> {
    const response = await api.get('/inquiries/stats');
    return response.data.data;
  }

  async getTemplates(category?: string) {
    const params = category ? { category } : {};
    const response = await api.get('/inquiries/templates', { params });
    return response.data.data;
  }

  async rateSatisfaction(inquiryId: string, rating: number, note?: string) {
    const response = await api.post(`/inquiries/${inquiryId}/satisfaction`, {
      rating,
      note
    });
    return response.data.data;
  }
}

export const inquiryService = new InquiryService();