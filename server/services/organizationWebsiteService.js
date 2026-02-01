import Organization from '../models/Organization.js';

class OrganizationWebsiteService {
    async generateWebsite(organization) {
        try {
            console.log(`🔄 Generating website for organization: ${organization.name}`);
            
            // Generate public URL for this organization
            const publicUrl = `http://localhost:5000/public/organization/${organization._id}`;
            
            console.log(`✅ Website URL generated: ${publicUrl}`);
            return publicUrl;
            
        } catch (error) {
            console.error('Error generating website:', error);
            throw new Error('فشل في إنشاء رابط الموقع');
        }
    }

    async deleteWebsite(organizationId) {
        try {
            console.log(`ℹ️ Website deleted for organization: ${organizationId}`);
        } catch (error) {
            console.error('Error deleting website:', error);
        }
    }
}

export default new OrganizationWebsiteService();