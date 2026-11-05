package com.hms.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.nio.file.Paths;

/**
 * Serves uploaded lab report files (PDFs, images) from the local filesystem
 * via the Spring static-resource handler.
 *
 * <p>The path {@code /lab/files/**} (under the {@code /api} context-path, so
 * the full URL is {@code /api/lab/files/<filename>}) is mapped to the
 * {@code lab-reports/} sub-folder of the upload directory.
 *
 * <p>Note: actual file downloads go through the {@code LabController.serveFile}
 * streaming endpoint which also sets {@code Content-Disposition}.  This handler
 * is a fallback / alternative for simple direct-URL access.
 */
@Configuration
public class WebMvcConfig implements WebMvcConfigurer {

    @Value("${app.upload.dir:/data}")
    private String uploadBaseDir;

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        String location = Paths.get(uploadBaseDir)
                .resolve("lab-reports")
                .toAbsolutePath()
                .toUri()
                .toString();

        // /api/lab/files/<filename>  →  <uploadBaseDir>/lab-reports/<filename>
        registry.addResourceHandler("/lab/files/**")
                .addResourceLocations(location + "/");
    }
}
