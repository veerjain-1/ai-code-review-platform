package com.aireview.gate.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

/**
 * Gate check rule configuration loaded from application.yml.
 */
@Configuration
@ConfigurationProperties(prefix = "gate.rules")
public class GateRulesConfig {

    private int maxCriticalIssues = 0;
    private int maxWarnings = 5;
    private int maxDiffSize = 2000;
    private boolean requireTestsForNewFiles = true;
    private boolean blockOnSecurityIssues = true;

    // Getters and Setters
    public int getMaxCriticalIssues() { return maxCriticalIssues; }
    public void setMaxCriticalIssues(int maxCriticalIssues) { this.maxCriticalIssues = maxCriticalIssues; }

    public int getMaxWarnings() { return maxWarnings; }
    public void setMaxWarnings(int maxWarnings) { this.maxWarnings = maxWarnings; }

    public int getMaxDiffSize() { return maxDiffSize; }
    public void setMaxDiffSize(int maxDiffSize) { this.maxDiffSize = maxDiffSize; }

    public boolean isRequireTestsForNewFiles() { return requireTestsForNewFiles; }
    public void setRequireTestsForNewFiles(boolean requireTestsForNewFiles) { this.requireTestsForNewFiles = requireTestsForNewFiles; }

    public boolean isBlockOnSecurityIssues() { return blockOnSecurityIssues; }
    public void setBlockOnSecurityIssues(boolean blockOnSecurityIssues) { this.blockOnSecurityIssues = blockOnSecurityIssues; }

    @Override
    public String toString() {
        return String.format(
            "GateRules{maxCritical=%d, maxWarnings=%d, maxDiffSize=%d, requireTests=%b, blockSecurity=%b}",
            maxCriticalIssues, maxWarnings, maxDiffSize, requireTestsForNewFiles, blockOnSecurityIssues
        );
    }
}
