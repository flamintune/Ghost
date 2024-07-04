const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const crypto = require('crypto');
const errors = require('@tryghost/errors');
const urlJoin = require('url-join');
const path = require('path');

/** @type {import('@tryghost/api-framework').Controller} */
const controller = {
    docName: 'r2PresignedUrl',

    getPresignedUrl: {
        headers: {
            cacheInvalidate: false
        },
        permissions: false,
        data: [
            'fileName',
            'fileType'
        ],
        async query(frame) {
            const { fileName, fileType } = frame.data;
            // 配置 R2 客户端
            const r2Client = new S3Client({
                region: 'auto',
                endpoint: `${process.env.endpoint}`,
                credentials: {
                    accessKeyId: process.env.ACCESS_KEY_ID,
                    secretAccessKey: process.env.SECRET_ACCESS_KEY
                }
            });

            // 生成唯一的文件名
            let uniqueFileName = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}-${fileName}`;
            if (process.env.pathPrefix)
                uniqueFileName = path.join(process.env.pathPrefix,uniqueFileName)
            const command = new PutObjectCommand({
                Bucket: process.env.BUCKET_NAME,
                Key: uniqueFileName,
                ContentType: fileType
            });

            try {
                const presignedUrl = await getSignedUrl(r2Client, command, { expiresIn: 3600 });

                // 使用自定义域名（如果配置了）或默认的 R2 公共 URL
                const customDomain = process.env.CUSTOM_HOST;
                let fileUrl;
                if (customDomain) {
                    fileUrl = urlJoin(`https://${customDomain}`, uniqueFileName);
                } else {
                    fileUrl = `${process.env.R2_PUBLIC_URL}/${uniqueFileName}`;
                }
                console.log(fileUrl)
                return {
                    presignedUrl,
                    fileUrl
                };
            } catch (error) {
                throw new errors.InternalServerError({
                    message: 'Failed to generate presigned URL',
                    err: error
                });
            }
        }
    }
};

module.exports = controller;