const cloudinary = require("cloudinary").v2

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

const uploadToCloudinary = async (file, folder = "zord") => {
  try {
    const result = await cloudinary.uploader.upload(file.path, {
      folder: folder,
      resource_type: "auto",
      quality: "auto:good",
      fetch_format: "auto",
    })

    return {
      url: result.secure_url,
      publicId: result.public_id,
    }
  } catch (error) {
    throw new Error("Failed to upload to Cloudinary")
  }
}

const deleteFromCloudinary = async (publicId) => {
  try {
    await cloudinary.uploader.destroy(publicId)
  } catch (error) {
    console.error("Failed to delete from Cloudinary:", error)
  }
}

module.exports = { uploadToCloudinary, deleteFromCloudinary }
